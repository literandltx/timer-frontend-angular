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
import {LogService} from '../log/log.service';
import {EntityType} from '../db/app.db';

@Injectable({providedIn: 'root'})
export class EntitySyncOrchestrator {
  private health = inject(HealthCheckService);
  private auth = inject(AuthService);
  private wsCore = inject(WebSocketCoreService);
  private syncTimestamp = inject(SyncTimestampService);
  private syncEngine = inject(SyncEngineService);
  private log = inject(LogService);

  public setupSync<T extends SyncEntity, CreateReq, UpdateReq>(
    entityType: EntityType,
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
            this.log.info(`[SyncOrchestrator][${entityType}] System Ready. Processing offline queue & pulling missed updates...`);
            return from(this.syncEngine.processQueueV2(entityType)).pipe(
              switchMap(() => this.pullMissedUpdates(entityType, apiService, dbTable)),
              switchMap(() => {
                onDataChanged();
                if (useWs) {
                  this.log.info(`[SyncOrchestrator][${entityType}] Active devices >= 2. Establishing WebSocket connection to topic: ${wsTopic}`);
                  return this.wsCore.watch<SyncMessage<T>>(wsTopic);
                } else {
                  this.log.info(`[SyncOrchestrator][${entityType}] Active devices < 2. WebSocket disabled. Relying on background HTTP sync only.`);
                  return EMPTY;
                }
              })
            );
          }
          this.log.warn(`[SyncOrchestrator][${entityType}] Sync paused: System is either offline or user is not authenticated.`);
          return EMPTY;
        }),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe({
        next: async (message) => {
          this.log.info(`[SyncOrchestrator][${entityType}] WebSocket message received: [${message.action}] for UUID ${message.payload.uuid}`);
          await this.processIncomingSyncMessage(message, entityType, dbTable);
          await onDataChanged();
        },
        error: (err) => this.log.error(`[SyncOrchestrator][${entityType}] WebSocket error:`, err)
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
          .filter(u => u.deleted)
          .map(u => u.uuid);

        const toUpdate = updates
          .filter(u => !u.deleted);

        if (toUpdate.length > 0) {
          await dbTable.bulkPut(toUpdate);
          this.log.info(`[SyncOrchestrator][${entityType}] Pulled ${toUpdate.length} new/updated items via HTTP.`);
        }

        if (toDeleteIds.length > 0) {
          await dbTable.bulkDelete(toDeleteIds);
          this.log.info(`[SyncOrchestrator][${entityType}] Purged ${toDeleteIds.length} deleted items from local DB.`);
        }
      } else {
        this.log.info(`[SyncOrchestrator][${entityType}] HTTP Pull complete. No new updates found.`);
      }
      this.syncTimestamp.update(entityType);
    } catch (error) {
      this.log.error(`[SyncOrchestrator][${entityType}] Failed to pull HTTP updates:`, error);
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
            this.log.info(`[SyncOrchestrator][${entityType}] Local DB updated via WebSocket.`);
          } else {
            this.log.info(`[SyncOrchestrator][${entityType}] Record already up to date, skipping WS update.`);
          }
          break;
        }
        case SyncAction.DELETE:
          if (await dbTable.get(payload.uuid)) {
            await dbTable.delete(payload.uuid);
            this.log.info(`[SyncOrchestrator][${entityType}] Item deleted via WebSocket.`);
          }
          break;
        default:
          this.log.warn(`[SyncOrchestrator][${entityType}] Unhandled WS action: ${action}`);
          return;
      }
      this.syncTimestamp.update(entityType);
    } catch (error) {
      this.log.error(`[SyncOrchestrator][${entityType}] Failed to process WS message:`, error);
    }
  }
}
