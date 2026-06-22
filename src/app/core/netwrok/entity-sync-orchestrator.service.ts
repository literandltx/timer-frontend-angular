import {Injectable, computed, inject, DestroyRef} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {switchMap, firstValueFrom, EMPTY, from} from 'rxjs';
import {Table} from 'dexie';

import {HealthCheckService} from '../netwrok/health.service';
import {AuthService} from '../auth/auth.service';
import {WebSocketCoreService} from '../netwrok/websocket.service';
import {SyncTimestampService} from '../netwrok/sync-state.service';
import {SyncEngineService} from '../services/sync-engine.service';
import {SyncMessage, SyncAction} from '../netwrok/sync-message.model';
import {isEqual} from '../../shared/utils/object.utils';
import {SyncEntity} from '../models/sync-entity.model';
import {SyncApiService} from '../netwrok/sync-api.service';

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
      isReady: this.health.isHealthy() && this.auth.isAuthenticatedSignal()
    }));

    toObservable(syncState)
      .pipe(
        switchMap(({isReady}) => {
          if (isReady) {
            return from(this.syncEngine.processQueue(entityType, apiService)).pipe(
              switchMap(() => this.pullMissedUpdates(entityType, apiService, dbTable)),
              switchMap(() => {
                onDataChanged();
                return this.wsCore.watch<SyncMessage<T>>(wsTopic);
              })
            );
          }
          return EMPTY;
        }),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe({
        next: async (message) => {
          await this.processIncomingSyncMessage(message, entityType, dbTable);
          await onDataChanged();
        },
        error: (err) => console.error(`[SyncOrchestrator] WS error for ${entityType}:`, err)
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
        }

        if (toDeleteIds.length > 0) {
          await dbTable.bulkDelete(toDeleteIds);
          console.log(`[SyncOrchestrator] Purged ${toDeleteIds.length} deleted items from local DB for ${entityType}`);
        }
      }
      this.syncTimestamp.update(entityType);
    } catch (error) {
      console.error(`[SyncOrchestrator] Failed to pull updates for ${entityType}`, error);
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
        case SyncAction.UPDATE:
          const existingRecord = await dbTable.get(payload.uuid);
          if (!existingRecord || !isEqual(existingRecord, payload)) {
            await dbTable.put(payload);
          }
          break;
        case SyncAction.DELETE:
          if (await dbTable.get(payload.uuid)) {
            await dbTable.delete(payload.uuid);
            console.log(`[SyncOrchestrator] Deleted item via WS for ${entityType}`);
          }
          break;
        default:
          console.warn(`[SyncOrchestrator] Unhandled action: ${action}`);
          return;
      }
      this.syncTimestamp.update(entityType);
    } catch (error) {
      console.error(`[SyncOrchestrator] Process error for ${entityType}:`, error);
    }
  }
}
