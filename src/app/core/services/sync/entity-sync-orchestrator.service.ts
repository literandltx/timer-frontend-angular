import {Injectable, computed, inject, DestroyRef} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {switchMap, concatMap, firstValueFrom, EMPTY, from, catchError, Observable} from 'rxjs';
import {Table} from 'dexie';

import {HealthCheckService} from '../../netwrok/health.service';
import {AuthService} from '../../auth/auth.service';
import {WebSocketCoreService} from '../../netwrok/websocket.service';
import {UserContextStorageService} from '../../storage/user-context-storage.service';
import {SyncEngineService} from './sync-engine.service';
import {SyncMessage, SyncAction} from '../../netwrok/sync-message.model';
import {isEqual} from '../../../shared/utils/object.utils';
import {SyncEntity} from '../../models/sync-entity.model';
import {SyncApiService} from '../../netwrok/sync-api.service';
import {LogService} from '../../log/log.service';
import {EntityType} from '../../db/app.db';

interface SyncState {
  isReady: boolean;
  useWs: boolean;
}

@Injectable({providedIn: 'root'})
export class EntitySyncOrchestrator {
  private health = inject(HealthCheckService);
  private auth = inject(AuthService);
  private wsCore = inject(WebSocketCoreService);
  private userContextStorage = inject(UserContextStorageService);
  private syncEngine = inject(SyncEngineService);
  private log = inject(LogService);

  public setupSync<T extends SyncEntity, CreateReq, UpdateReq>(
    entityType: EntityType,
    wsTopic: string,
    apiService: SyncApiService<T, CreateReq, UpdateReq>,
    dbTable: Table<T, string>,
    destroyRef: DestroyRef,
    onDataChanged: () => void | Promise<void>
  ): void {
    const syncState$ = this.createSyncStateStream();

    syncState$
      .pipe(
        switchMap(state => this.handleSyncState(
          state,
          entityType,
          wsTopic,
          apiService,
          dbTable,
          onDataChanged
        )),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe();
  }

  /**
   * Creates a reactive stream of the overall system sync readiness.
   */
  private createSyncStateStream(): Observable<SyncState> {
    const syncState = computed(() => ({
      isReady: this.health.isHealthy() && this.auth.isAuthenticatedSignal(),
      useWs: this.health.isWsEnabled()
    }));

    return toObservable(syncState);
  }

  /**
   * Orchestrates the sync lifecycle when the state changes.
   */
  private handleSyncState<T extends SyncEntity, CreateReq, UpdateReq>(
    state: SyncState,
    entityType: EntityType,
    wsTopic: string,
    apiService: SyncApiService<T, CreateReq, UpdateReq>,
    dbTable: Table<T, string>,
    onDataChanged: () => void | Promise<void>
  ): Observable<unknown> {
    if (!state.isReady) {
      this.log.warn(`[SyncOrchestrator][${entityType}] Sync paused: Offline or unauthenticated.`);
      return EMPTY;
    }

    this.log.info(`[SyncOrchestrator][${entityType}] System Ready. Starting sync sequence...`);

    return from(this.performInitialSync(entityType, apiService, dbTable)).pipe(
      concatMap(async () => {
        await onDataChanged();
      }),
      switchMap(() => this.setupWebSocket(state.useWs, entityType, wsTopic, dbTable, onDataChanged)),
      catchError(error => {
        this.log.error(`[SyncOrchestrator][${entityType}] Sync sequence failed:`, error);
        return EMPTY;
      })
    );
  }

  /**
   * Handles offline queue processing and fetching missed HTTP updates.
   */
  private async performInitialSync<T extends SyncEntity, CreateReq, UpdateReq>(
    entityType: EntityType,
    apiService: SyncApiService<T, CreateReq, UpdateReq>,
    dbTable: Table<T, string>
  ): Promise<void> {
    this.log.info(`[SyncOrchestrator][${entityType}] Processing offline queue...`);
    await this.syncEngine.processQueueV2(entityType);

    this.log.info(`[SyncOrchestrator][${entityType}] Pulling missed updates...`);
    await this.pullMissedUpdates(entityType, apiService, dbTable);
  }

  /**
   * Establishes the WebSocket listener if conditions are met.
   */
  private setupWebSocket<T extends SyncEntity>(
    useWs: boolean,
    entityType: EntityType,
    wsTopic: string,
    dbTable: Table<T, string>,
    onDataChanged: () => void | Promise<void>
  ): Observable<unknown> {
    if (!useWs) {
      this.log.info(`[SyncOrchestrator][${entityType}] Active devices < 2. WS disabled. Relying on background HTTP sync.`);
      return EMPTY;
    }

    this.log.info(`[SyncOrchestrator][${entityType}] Connecting WebSocket: ${wsTopic}`);

    return this.wsCore.watch<SyncMessage<T>>(wsTopic).pipe(
      concatMap(async (message) => {
        this.log.info(`[SyncOrchestrator][${entityType}] WS message: [${message.action}] for ${message.payload.uuid}`);
        await this.processIncomingSyncMessage(message, entityType, dbTable);
        await onDataChanged();
      }),
      catchError(error => {
        this.log.error(`[SyncOrchestrator][${entityType}] WebSocket stream error:`, error);
        return EMPTY;
      })
    );
  }

  /**
   * Pulls HTTP updates based on the last sync timestamp.
   */
  private async pullMissedUpdates<T extends SyncEntity, CreateReq, UpdateReq>(
    entityType: string,
    apiService: SyncApiService<T, CreateReq, UpdateReq>,
    dbTable: Table<T, string>
  ): Promise<void> {
    try {
      const lastSync = this.userContextStorage.getSyncTimestamp(entityType);
      const updates = await firstValueFrom(apiService.pullUpdates(lastSync));

      if (!updates?.length) {
        this.log.info(`[SyncOrchestrator][${entityType}] HTTP Pull complete. No new updates.`);
        return;
      }

      const toDeleteIds: string[] = [];
      const toUpdate: T[] = [];

      for (const update of updates) {
        if (this.isEntityDeleted(update)) {
          toDeleteIds.push(update.uuid);
        } else {
          toUpdate.push(update);
        }
      }

      if (toUpdate.length > 0) {
        await dbTable.bulkPut(toUpdate);
        this.log.info(`[SyncOrchestrator][${entityType}] Pulled ${toUpdate.length} updates via HTTP.`);
      }

      if (toDeleteIds.length > 0) {
        await dbTable.bulkDelete(toDeleteIds);
        this.log.info(`[SyncOrchestrator][${entityType}] Purged ${toDeleteIds.length} items from local DB.`);
      }

      const maxServerUpdatedAt = updates
        .map(u => u.serverUpdatedAt)
        .filter(Boolean)
        .sort()
        .at(-1);

      this.advanceSyncTimestamp(entityType, maxServerUpdatedAt);
    } catch (error) {
      this.log.error(`[SyncOrchestrator][${entityType}] Failed to pull HTTP updates:`, error);
      throw error;
    }
  }

  /**
   * Processes individual WebSocket messages updating the local Dexie DB.
   */
  private async processIncomingSyncMessage<T extends SyncEntity>(
    message: SyncMessage<T>,
    entityType: string,
    dbTable: Table<T, string>
  ): Promise<void> {
    const {action, payload} = message;
    const effectiveAction = this.isEntityDeleted(payload) ? SyncAction.DELETE : action;

    try {
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
        case SyncAction.DELETE: {
          if (await dbTable.get(payload.uuid)) {
            await dbTable.delete(payload.uuid);
            this.log.info(`[SyncOrchestrator][${entityType}] Item deleted via WebSocket.`);
          }
          break;
        }
        default: {
          this.log.warn(`[SyncOrchestrator][${entityType}] Unhandled WS action: ${action}`);
          return;
        }
      }

      this.advanceSyncTimestamp(entityType, payload.serverUpdatedAt);
    } catch (error) {
      this.log.error(`[SyncOrchestrator][${entityType}] Failed to process WS message:`, error);
    }
  }

  /**
   * Helper to normalize payload deletion checks.
   */
  private isEntityDeleted(payload: any): boolean {
    return payload?.deleted === true || payload?.isDeleted === true;
  }

  /**
   * Advances the stored timestamp tracking local DB state vs server DB state.
   */
  private advanceSyncTimestamp(entityType: string, candidate?: string): void {
    if (!candidate) {
      return;
    }

    const current = this.userContextStorage.getSyncTimestamp(entityType);

    if (!current || new Date(candidate) > new Date(current)) {
      this.userContextStorage.updateSyncTimestamp(entityType, candidate);
    }
  }
}
