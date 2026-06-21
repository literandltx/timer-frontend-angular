import {Injectable, signal, computed, inject, DestroyRef} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {firstValueFrom, switchMap, EMPTY, from} from 'rxjs';

import {Label, CreateLabelRequest, UpdateLabelRequest} from '../models/label.model';
import {AppDB} from '../../../core/db/app.db';
import {LabelApiService} from './label-api.service';
import {HealthCheckService} from '../../../core/netwrok/health.service';
import {SyncMessage, SyncAction} from '../../../core/netwrok/sync-message.model';
import {WebSocketCoreService} from '../../../core/netwrok/websocket.service';
import {AuthService} from '../../../core/auth/auth.service';
import {isEqual} from '../../../shared/utils/object.utils';

@Injectable({providedIn: 'root'})
export class LabelService {

  private db = inject(AppDB);
  private health = inject(HealthCheckService);
  private auth = inject(AuthService);
  private labelApi = inject(LabelApiService);
  private wsCore = inject(WebSocketCoreService);
  private destroyRef = inject(DestroyRef);

  public labels = signal<Label[]>([]);
  private readonly SYNC_KEY = 'last_label_sync';

  constructor() {
    this.loadLabels();
    this.setupSyncAndWebSockets();
  }

  async loadLabels() {
    try {
      const labels: Label[] = await this.db.labels.toArray();
      this.labels.set(labels);
    } catch (error) {
      console.error('[LabelService] Failed to load labels from DB', error);
    }
  }

  async save(request: CreateLabelRequest) {
    const uuid = (request as any).uuid || crypto.randomUUID();
    const optimisticLabel = {...request, uuid} as unknown as Label;

    await this.executeMutation(
      'CREATE',
      uuid,
      request,
      () => firstValueFrom(this.labelApi.save(request)),
      (newLabel) => this.upsertLocalLabel(newLabel || optimisticLabel),
      'save label'
    );
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    const existingLabel = await this.db.labels.get(uuid);
    const optimisticLabel = {...existingLabel, ...request} as Label;

    await this.executeMutation(
      'UPDATE',
      uuid,
      request,
      () => firstValueFrom(this.labelApi.update(uuid, request)),
      (updatedLabel) => this.upsertLocalLabel(updatedLabel || optimisticLabel),
      `update label ${uuid}`
    );
  }

  async delete(uuid: string) {
    await this.executeMutation(
      'DELETE',
      uuid,
      null,
      () => firstValueFrom(this.labelApi.delete(uuid)),
      () => this.deleteLocalLabel(uuid),
      `delete label ${uuid}`
    );
  }

  private setupSyncAndWebSockets() {
    const syncState = computed(() => ({
      isReady: this.health.isHealthy() && this.auth.isAuthenticatedSignal()
    }));

    toObservable(syncState)
      .pipe(
        switchMap(({isReady}) => this.handleConnectionStateChange(isReady)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: async (message: SyncMessage<Label>) => await this.processIncomingSyncMessage(message),
        error: (err: unknown) => console.error('[LabelService] WS stream error:', err)
      });
  }

  private handleConnectionStateChange(isReady: boolean) {
    if (isReady) {
      return from(this.processSyncQueue()).pipe(
        switchMap(() => this.pullMissedUpdates()),
        switchMap(() => this.wsCore.watch<SyncMessage<Label>>('/user/queue/labels'))
      );
    } else {
      return EMPTY;
    }
  }

  private async processSyncQueue(): Promise<void> {
    const pendingActions = await this.db.syncQueue
      .where('entityType')
      .equals('LABEL')
      .filter(item => item.status === 'PENDING' || item.status === 'ERROR')
      .sortBy('timestamp');

    for (const item of pendingActions) {
      try {
        switch (item.action) {
          case 'CREATE':
            await firstValueFrom(this.labelApi.save(item.payload));
            break;
          case 'UPDATE':
            await firstValueFrom(this.labelApi.update(item.entityId, item.payload));
            break;
          case 'DELETE':
            await firstValueFrom(this.labelApi.delete(item.entityId));
            break;
        }

        if (item.id) {
          await this.db.syncQueue.delete(item.id);
        }
      } catch (error) {
        if (item.id) {
          await this.db.syncQueue.update(item.id, {
            status: 'ERROR',
            retries: (item.retries || 0) + 1,
            lastError: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }

  private async pullMissedUpdates(): Promise<void> {
    try {
      const lastSync = localStorage.getItem(this.SYNC_KEY);
      const updates = await firstValueFrom(this.labelApi.pullUpdates(lastSync));

      if (updates && updates.length > 0) {
        await this.db.transaction('rw', this.db.labels, async () => {
          await this.db.labels.bulkPut(updates);
        });
        await this.loadLabels();
      }

      this.updateSyncTimestamp();
    } catch (error) {
      console.error('[LabelService] Failed to pull updates from server', error);
    }
  }

  private async processIncomingSyncMessage(message: SyncMessage<Label>) {
    const {action, payload} = message;

    try {
      switch (action) {
        case SyncAction.CREATE:
        case SyncAction.UPDATE:
          await this.handleIncomingUpsert(payload);
          break;
        case SyncAction.DELETE:
          await this.handleIncomingDelete(payload.uuid);
          break;
        default:
          console.warn(`[LabelService] Unhandled sync action: ${action}`);
          return;
      }

      this.updateSyncTimestamp();
      await this.loadLabels();
    } catch (error) {
      console.error(`[LabelService] Failed to process ${action} for label:`, error);
    }
  }

  private async handleIncomingUpsert(payload: Label) {
    const existingRecord = await this.db.labels.get(payload.uuid);
    if (existingRecord && isEqual(existingRecord, payload)) {
      return;
    }
    await this.upsertLocalLabel(payload);
  }

  private async handleIncomingDelete(uuid: string) {
    const existingRecord = await this.db.labels.get(uuid);
    if (!existingRecord) {
      return;
    }
    await this.deleteLocalLabel(uuid);
  }

  private async executeMutation<T>(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityId: string,
    payload: any,
    apiCall: () => Promise<T>,
    dbUpdate: (result?: T) => Promise<void>,
    actionName: string
  ) {
    const isOnlineAndAuth = this.health.isHealthy() && this.auth.isAuthenticatedSignal();

    if (isOnlineAndAuth) {
      try {
        const result = await apiCall();
        await dbUpdate(result);
        this.updateSyncTimestamp();
      } catch (error) {
        console.error(`[LabelService] Failed to ${actionName} in API. Queueing offline action.`, error);
        await this.handleOfflineMutation(action, entityId, payload, dbUpdate);
      }
    } else {
      console.warn(`[LabelService] Offline or Unauthenticated. Adding ${actionName} to sync queue.`);
      await this.handleOfflineMutation(action, entityId, payload, dbUpdate);
    }

    await this.loadLabels();
  }

  private async handleOfflineMutation<T>(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityId: string,
    payload: any,
    optimisticDbUpdate: (result?: T) => Promise<void>
  ) {
    await this.db.transaction('rw', this.db.syncQueue, this.db.labels, async () => {
      await this.db.syncQueue.add({
        entityId,
        entityType: 'LABEL',
        action,
        payload,
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });

      await optimisticDbUpdate();
    });
  }

  private async upsertLocalLabel(label: Label) {
    await this.db.transaction('rw', this.db.labels, async () => {
      await this.db.labels.put(label);
    });
  }

  private async deleteLocalLabel(uuid: string) {
    await this.db.transaction('rw', this.db.labels, async () => {
      await this.db.labels.delete(uuid);
    });
  }

  private updateSyncTimestamp() {
    localStorage.setItem(this.SYNC_KEY, new Date().toISOString());
  }

}
