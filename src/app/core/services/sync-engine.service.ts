import {Injectable, inject} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {Table} from 'dexie';
import {AppDB, EntityType} from '../db/app.db';
import {HealthCheckService} from '../netwrok/health.service';
import {AuthService} from '../auth/auth.service';
import {SyncTimestampService} from '../netwrok/sync-state.service';
import {SyncApiService} from '../netwrok/sync-api.service';

@Injectable({providedIn: 'root'})
export class SyncEngineService {

  private db: AppDB = inject(AppDB);
  private health: HealthCheckService = inject(HealthCheckService);
  private auth: AuthService = inject(AuthService);
  private syncTimestamp: SyncTimestampService = inject(SyncTimestampService);

  async executeMutation<T>(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: EntityType,
    entityId: string,
    payload: any,
    apiCall: () => Promise<T>,
    optimisticDbUpdate: () => Promise<void>,
    dbTable: Table<any, string>
  ): Promise<void> {
    const isOnlineAndAuth = this.health.isHealthy() && this.auth.isAuthenticatedSignal();

    if (isOnlineAndAuth) {
      try {
        await apiCall();
        await optimisticDbUpdate();
        this.syncTimestamp.update(entityType);
      } catch (error) {
        await this.queueOfflineMutation(action, entityType, entityId, payload, optimisticDbUpdate, dbTable);
      }
    } else {
      await this.queueOfflineMutation(action, entityType, entityId, payload, optimisticDbUpdate, dbTable);
    }
  }

  async processQueue<T>(entityType: EntityType, apiService: SyncApiService<T, any, any>): Promise<void> {
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

  private async queueOfflineMutation(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: EntityType,
    entityId: string,
    payload: any,
    optimisticDbUpdate: () => Promise<void>,
    dbTable: Table<any, string>
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
