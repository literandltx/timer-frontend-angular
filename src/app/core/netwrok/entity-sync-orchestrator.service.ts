import {Injectable, computed, inject, DestroyRef} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {switchMap, firstValueFrom, EMPTY, from} from 'rxjs';
import {Table} from 'dexie';

import {HealthCheckService} from './health.service';
import {AuthService} from '../auth/auth.service';
import {WebSocketCoreService} from './websocket.service';
import {SyncTimestampService} from './sync-state.service';
import {SyncEngineService} from '../services/sync-engine.service';
import {SyncMessage, SyncAction} from './sync-message.model';
import {isEqual} from '../../shared/utils/object.utils';
import {SyncEntity} from '../models/sync-entity.model';
import {SyncApiService} from './sync-api.service';

@Injectable({providedIn: 'root'})
export class EntitySyncOrchestrator {
  private health = inject(HealthCheckService);
  private auth = inject(AuthService);
  private wsCore = inject(WebSocketCoreService);
  private syncTimestamp = inject(SyncTimestampService);
  private syncEngine = inject(SyncEngineService);

  public setupSync<T extends SyncEntity, CreateReq, UpdateReq>(
    entityType: Parameters<SyncEngineService['processQueue']>[0],
    wsTopic: string,
    apiService: SyncApiService<T, CreateReq, UpdateReq>,
    dbTable: Table<T, string>,
    destroyRef: DestroyRef,
    onDataChanged: () => void | Promise<void>
  ) {
    const syncState = computed(() => ({
      isReady: this.health.isHealthy() && this.auth.isAuthenticatedSignal(),
      useWs: this.health.isWsEnabled()
    }));

    toObservable(syncState)
      .pipe(
        switchMap(({isReady, useWs}) => {
          if (isReady) {
            console.info(`[SyncOrchestrator][${entityType}] System Ready. Processing offline queue & pulling missed updates...`);
            return from(this.syncEngine.processQueue(entityType, apiService)).pipe(
              switchMap(() => this.pullMissedUpdates(entityType, apiService, dbTable)),
              switchMap(() => {
                onDataChanged();
                if (useWs) {
                  console.info(`[SyncOrchestrator][${entityType}] Active devices >= 2. Establishing WebSocket connection to topic: ${wsTopic}`);
                  return this.wsCore.watch<SyncMessage<T>>(wsTopic);
                } else {
                  console.info(`[SyncOrchestrator][${entityType}] Active devices < 2. WebSocket disabled. Relying on background HTTP sync only.`);
                  return EMPTY;
                }
              })
            );
          }
          console.warn(`[SyncOrchestrator][${entityType}] Sync paused: System is either offline or user is not authenticated.`);
          return EMPTY;
        }),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe({
        next: async (message) => {
          console.info(`[SyncOrchestrator][${entityType}] WebSocket message received: [${message.action}] for UUID ${message.payload.uuid}`);
          await this.processIncomingSyncMessage(message, entityType, dbTable);
          await onDataChanged();
        },
        error: (err) => console.error(`[SyncOrchestrator][${entityType}] WebSocket error:`, err)
      });
  }

  private async pullMissedUpdates<T extends SyncEntity, CreateReq, UpdateReq>(
    entityType: string,
    apiService: SyncApiService<T, CreateReq, UpdateReq>,
    dbTable: Table<T, string>
  ): Promise<void> {
    try {
      const lastSync = this.syncTimestamp.get(entityType);
      const updates = await firstValueFrom(apiService.pullUpdates(lastSync));

      if (updates && updates.length > 0) {
        const toDeleteIds = updates
          .filter(u => (u as any).deleted === true || (u as any).isDeleted === true)
          .map(u => u.uuid);

        const toUpdate = updates
          .filter(u => (u as any).deleted !== true && (u as any).isDeleted !== true);

        if (toUpdate.length > 0) {
          await dbTable.bulkPut(toUpdate);
          console.info(`[SyncOrchestrator][${entityType}] Pulled ${toUpdate.length} new/updated items via HTTP.`);
        }

        if (toDeleteIds.length > 0) {
          await dbTable.bulkDelete(toDeleteIds);
          console.info(`[SyncOrchestrator][${entityType}] Purged ${toDeleteIds.length} deleted items from local DB.`);
        }
      } else {
        console.info(`[SyncOrchestrator][${entityType}] HTTP Pull complete. No new updates found.`);
      }
      this.syncTimestamp.update(entityType);
    } catch (error) {
      console.error(`[SyncOrchestrator][${entityType}] Failed to pull HTTP updates:`, error);
    }
  }

  private async processIncomingSyncMessage<T extends SyncEntity>(
    message: SyncMessage<T>,
    entityType: string,
    dbTable: Table<T, string>
  ) {
    const {action, payload} = message;

    try {
      const isPayloadDeleted = (payload as any).deleted === true || (payload as any).isDeleted === true;
      const effectiveAction = isPayloadDeleted ? SyncAction.DELETE : action;

      switch (effectiveAction) {
        case SyncAction.CREATE:
        case SyncAction.UPDATE: {
          const existingRecord = await dbTable.get(payload.uuid);
          if (!existingRecord || !isEqual(existingRecord, payload)) {
            await dbTable.put(payload);
            console.info(`[SyncOrchestrator][${entityType}] Local DB updated via WebSocket.`);
          } else {
            console.info(`[SyncOrchestrator][${entityType}] Record already up to date, skipping WS update.`);
          }
          break;
        }
        case SyncAction.DELETE:
          if (await dbTable.get(payload.uuid)) {
            await dbTable.delete(payload.uuid);
            console.info(`[SyncOrchestrator][${entityType}] Item deleted via WebSocket.`);
          }
          break;
        default:
          console.warn(`[SyncOrchestrator][${entityType}] Unhandled WS action: ${action}`);
          return;
      }
      this.syncTimestamp.update(entityType);
    } catch (error) {
      console.error(`[SyncOrchestrator][${entityType}] Failed to process WS message:`, error);
    }
  }
}
