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
    await this.executeMutation(
      () => firstValueFrom(this.labelApi.save(request)),
      (newLabel) => this.upsertLocalLabel(newLabel),
      'save label'
    );
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    await this.executeMutation(
      () => firstValueFrom(this.labelApi.update(uuid, request)),
      (updatedLabel) => this.upsertLocalLabel(updatedLabel),
      `update label ${uuid}`
    );
  }

  async delete(uuid: string) {
    await this.executeMutation(
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
      return from(this.pullMissedUpdates()).pipe(
        switchMap(() => this.wsCore.watch<SyncMessage<Label>>('/user/queue/labels'))
      );
    } else {
      return EMPTY;
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
    if (existingRecord && this.isEqual(existingRecord, payload)) {
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
    apiCall: () => Promise<T>,
    dbUpdate: (result: T) => Promise<void>,
    actionName: string
  ) {
    if (this.health.isHealthy()) {
      try {
        const result = await apiCall();
        await dbUpdate(result);
        this.updateSyncTimestamp();
      } catch (error) {
        console.error(`[LabelService] Failed to ${actionName} in API`, error);
        return;
      }
    } else {
      console.warn(`[LabelService] System offline. Adding ${actionName} to offline sync queue.`);
    }

    await this.loadLabels();
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

  private isEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) {
      return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (obj1[key] !== obj2[key]) {
        return false;
      }
    }
    return true;
  }
}
