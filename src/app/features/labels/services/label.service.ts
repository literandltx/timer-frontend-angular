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
import {SyncTimestampService} from '../../../core/netwrok/sync-state.service';
import {SyncEngineService} from '../../../core/services/sync-engine.service';

@Injectable({providedIn: 'root'})
export class LabelService {

  private db = inject(AppDB);
  private health = inject(HealthCheckService);
  private auth = inject(AuthService);
  private labelApi = inject(LabelApiService);
  private wsCore = inject(WebSocketCoreService);
  private destroyRef = inject(DestroyRef);
  private syncTimestamp = inject(SyncTimestampService);
  private syncEngine = inject(SyncEngineService);

  public labels = signal<Label[]>([]);
  private readonly ENTITY_TYPE = 'LABEL';

  constructor() {
    this.loadLabels();
    this.setupSyncAndWebSockets();
  }

  async loadLabels() {
    try {
      const labels: Label[] = await this.db.labels.toArray();
      this.labels.set(labels);
    } catch (error) {
      console.error(error);
    }
  }

  async save(request: CreateLabelRequest) {
    const uuid = (request as any).uuid || crypto.randomUUID();
    const optimisticLabel = {...request, uuid} as unknown as Label;

    await this.syncEngine.executeMutation(
      'CREATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => firstValueFrom(this.labelApi.save(request)),
      () => this.upsertLocalLabel(optimisticLabel),
      this.db.labels
    );
    await this.loadLabels();
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    const existingLabel = await this.db.labels.get(uuid);
    const optimisticLabel = {...existingLabel, ...request} as Label;

    await this.syncEngine.executeMutation(
      'UPDATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => firstValueFrom(this.labelApi.update(uuid, request)),
      () => this.upsertLocalLabel(optimisticLabel),
      this.db.labels
    );
    await this.loadLabels();
  }

  async delete(uuid: string) {
    await this.syncEngine.executeMutation(
      'DELETE',
      this.ENTITY_TYPE,
      uuid,
      null,
      () => firstValueFrom(this.labelApi.delete(uuid)),
      () => this.deleteLocalLabel(uuid),
      this.db.labels
    );
    await this.loadLabels();
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
      return from(this.syncEngine.processQueue(this.ENTITY_TYPE, this.labelApi)).pipe(
        switchMap(() => this.pullMissedUpdates()),
        switchMap(() => this.wsCore.watch<SyncMessage<Label>>('/user/queue/labels'))
      );
    } else {
      return EMPTY;
    }
  }

  private async pullMissedUpdates(): Promise<void> {
    try {
      const lastSync = this.syncTimestamp.get(this.ENTITY_TYPE);
      const updates = await firstValueFrom(this.labelApi.pullUpdates(lastSync));

      if (updates && updates.length > 0) {
        await this.db.transaction('rw', this.db.labels, async () => {
          await this.db.labels.bulkPut(updates);
        });
        await this.loadLabels();
      }

      this.syncTimestamp.update(this.ENTITY_TYPE);
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

      this.syncTimestamp.update(this.ENTITY_TYPE);
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
}
