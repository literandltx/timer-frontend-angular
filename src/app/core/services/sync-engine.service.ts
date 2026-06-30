import {Injectable, inject} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {Table} from 'dexie';
import {AppDB, EntityType} from '../db/app.db';
import {HealthCheckService} from '../netwrok/health.service';
import {AuthService} from '../auth/auth.service';
import {SyncTimestampService} from '../netwrok/sync-state.service';
import {SyncApiService} from '../netwrok/sync-api.service';
import {HttpClient} from "@angular/common/http";
import {environment} from '../../../environments/environment';

export interface SyncBulkResponse {
  successfulIds: number[];
  failedActions: { id: number; error: string }[];
}

@Injectable({providedIn: 'root'})
export class SyncEngineService {

  private db: AppDB = inject(AppDB);
  private health: HealthCheckService = inject(HealthCheckService);
  private auth: AuthService = inject(AuthService);
  private syncTimestamp: SyncTimestampService = inject(SyncTimestampService);
  private http: HttpClient = inject(HttpClient);

  private endpoint = `${environment.base_url}/api/v1/sync/queue`;

  async executeMutation<T>(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: EntityType,
    entityId: string,
    payload: unknown,
    apiCall: () => Promise<T>,
    optimisticDbUpdate: () => Promise<void>,
    dbTable: Table<unknown, string>
  ): Promise<void> {
    const isOnlineAndAuth = this.health.isHealthy() && this.auth.isAuthenticatedSignal();

    if (isOnlineAndAuth) {
      try {
        await apiCall();
        await optimisticDbUpdate();
        this.syncTimestamp.update(entityType);
      } catch {
        await this.queueOfflineMutation(action, entityType, entityId, payload, optimisticDbUpdate, dbTable);
      }
    } else {
      await this.queueOfflineMutation(action, entityType, entityId, payload, optimisticDbUpdate, dbTable);
    }
  }

  /**
   * V1 Processing: Processes items one by one.
   */
  async processQueue<T>(entityType: EntityType, apiService: SyncApiService<T, unknown, unknown>): Promise<void> {
    const pendingActions = await this.db.syncQueue
      .where('entityType')
      .equals(entityType)
      .filter(item => item.status === 'PENDING' || item.status === 'ERROR')
      .sortBy('timestamp');

    for (const item of pendingActions) {
      try {
        switch (item.action) {
          case 'CREATE':
            await firstValueFrom(apiService.save(item.payload));
            break;
          case 'UPDATE':
            await firstValueFrom(apiService.update(item.entityId, item.payload));
            break;
          case 'DELETE':
            await firstValueFrom(apiService.delete(item.entityId));
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

  /**
   * V2 Orchestrator: Enforces exact dependency execution order.
   */
  async processAllQueuesInOrder(): Promise<void> {
    // Exact order: Independent entities first, dependent entities last
    const executionOrder: EntityType[] = [
      'TIMER_OPTION',
      'LABEL',
      'TIMER_SETTING',
      'TIMER_ENTRY'
    ];

    for (const entityType of executionOrder) {
      await this.processQueueV2(entityType);
    }
  }

  /**
   * V2 Bulk Processing: Sends all pending queue items for an entity in one request.
   */
  async processQueueV2(entityType: EntityType): Promise<void> {
    const pendingActions = await this.db.syncQueue
      .where('entityType')
      .equals(entityType)
      .filter(item => item.status === 'PENDING' || item.status === 'ERROR')
      .sortBy('timestamp');

    if (pendingActions.length === 0) {
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<SyncBulkResponse>(this.endpoint, {actions: pendingActions})
      );

      await this.db.transaction('rw', this.db.syncQueue, async () => {
        if (response.successfulIds && response.successfulIds.length > 0) {
          await this.db.syncQueue.bulkDelete(response.successfulIds);
        }

        if (response.failedActions && response.failedActions.length > 0) {
          for (const failed of response.failedActions) {
            const originalItem = pendingActions.find(p => p.id === failed.id);
            if (originalItem && originalItem.id !== undefined) {
              await this.db.syncQueue.update(originalItem.id, {
                status: 'ERROR',
                retries: (originalItem.retries || 0) + 1,
                lastError: failed.error
              });
            }
          }
        }
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      await this.db.transaction('rw', this.db.syncQueue, async () => {
        for (const item of pendingActions) {
          if (item.id !== undefined) {
            await this.db.syncQueue.update(item.id, {
              status: 'ERROR',
              retries: (item.retries || 0) + 1,
              lastError: errorMsg
            });
          }
        }
      });
    }
  }

  private async queueOfflineMutation(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: EntityType,
    entityId: string,
    payload: unknown,
    optimisticDbUpdate: () => Promise<void>,
    dbTable: Table<unknown, string>
  ) {
    await this.db.transaction('rw', this.db.syncQueue, dbTable, async () => {
      await this.db.syncQueue.add({
        entityId,
        entityType,
        action,
        payload,
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
      await optimisticDbUpdate();
    });
  }
}
