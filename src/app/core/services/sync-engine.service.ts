import {Injectable, inject} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {AppDB, EntityType} from '../db/app.db';
import {HealthCheckService} from '../netwrok/health.service';
import {AuthService} from '../auth/auth.service';
import {UserContextStorageService} from '../storage/user-context-storage.service';
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
  private userContextStorage: UserContextStorageService = inject(UserContextStorageService);
  private http: HttpClient = inject(HttpClient);

  private readonly endpoint = `${environment.base_url}/api/v1/sync/queue`;

  async executeMutation<T>(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: EntityType,
    entityId: string,
    payload: unknown,
    apiCall: () => Promise<T>,
    optimisticDbUpdate: () => Promise<void>
  ): Promise<void> {
    await optimisticDbUpdate();

    const isOnlineAndAuth = this.health.isHealthy() && this.auth.isAuthenticatedSignal();

    if (!isOnlineAndAuth) {
      await this.enqueue(action, entityType, entityId, payload);
      return;
    }

    apiCall()
      .then(() => this.userContextStorage.updateSyncTimestamp(entityType))
      .catch(async () => {
        await this.enqueue(action, entityType, entityId, payload);
      });
  }

  /**
   * V2 Bulk Processing: Sends all pending queue items for an entity in one request.
   */
  async processQueueV2(entityType: EntityType): Promise<void> {
    console.log("processQueueV2")
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

  private async enqueue(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: EntityType,
    entityId: string,
    payload: unknown
  ): Promise<void> {
    await this.db.syncQueue.add({
      entityId,
      entityType,
      action,
      payload,
      timestamp: Date.now(),
      status: 'PENDING',
      retries: 0
    });
  }
}
