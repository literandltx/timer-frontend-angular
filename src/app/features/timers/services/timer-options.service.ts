import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  TimerOption,
  CreateTimerOptionRequest,
  UpdateTimerOptionRequest
} from '../models/timer-option.model';
import { WebSocketCoreService } from '../../../core/netwrok/websocket.service';
import { SyncMessage, SyncAction } from '../../../core/netwrok/sync-message.model';
import { AppDB } from '../../../core/db/app.db';
import { AuthService } from '../../../core/auth/auth.service';
import { TimerOptionsApiService } from './timer-options-api.service';
import { HealthCheckService } from '../../../core/netwrok/health.service';

@Injectable({ providedIn: 'root' })
export class TimerOptionsService implements OnDestroy {
  private baseUrl = 'http://localhost:8080';
  private optionsApiUrl = 'http://localhost:8080/api/v1/timer-options';
  private lastSyncKey = 'last_timer_options_sync_time';

  private db: AppDB = inject(AppDB);
  private authService: AuthService = inject(AuthService);
  private optionsApi: TimerOptionsApiService = inject(TimerOptionsApiService);
  private webSocket: WebSocketCoreService = inject(WebSocketCoreService);
  private healthCheckService: HealthCheckService = inject(HealthCheckService);

  private isSyncing = false;
  private wsSubscription?: Subscription;

  public options = signal<TimerOption[]>([]);

  constructor() {
    this.loadOptions();
    this.initWebSocketConnection();
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
  }

  private initWebSocketConnection() {
    if (this.authService.isAuthenticated()) {
      const token = this.authService.getToken();
      if (!token) return;

      this.webSocket.connect(this.baseUrl, token);

      this.wsSubscription = this.webSocket.watch<SyncMessage<TimerOption>>('/user/queue/timer-options').subscribe({
        next: (incomingMessage) => this.handleIncomingSync(incomingMessage),
        error: (err) => console.error(err)
      });

      this.webSocket.onConnected$.subscribe(async () => {
        await this.pullServerChanges();
        await this.processSyncQueue();
      });
    }
  }

  private async pullServerChanges() {
    try {
      const lastSyncTime = localStorage.getItem(this.lastSyncKey);

      const updatedOptions = await firstValueFrom(
        this.optionsApi.pullUpdates(this.optionsApiUrl, lastSyncTime)
      );

      if (updatedOptions && updatedOptions.length > 0) {
        await this.db.transaction('rw', this.db.timerOptions, async () => {
          if (!lastSyncTime) {
            await this.db.timerOptions.clear();
            await this.db.timerOptions.bulkAdd(updatedOptions);
          } else {
            const optionsToUpsert = updatedOptions.filter(opt => !opt.deleted);
            const optionsToDelete = updatedOptions
              .filter(opt => opt.deleted)
              .map(opt => opt.uuid);

            if (optionsToUpsert.length > 0) await this.db.timerOptions.bulkPut(optionsToUpsert);
            if (optionsToDelete.length > 0) await this.db.timerOptions.bulkDelete(optionsToDelete);
          }
        });
        await this.loadOptions();
      }

      localStorage.setItem(this.lastSyncKey, new Date().toISOString());
    } catch (error) {
      console.error(error);
    }
  }

  async handleIncomingSync(incomingMessage: SyncMessage<TimerOption>) {
    const action = incomingMessage.action;
    const payload = incomingMessage.payload;

    try {
      switch (action) {
        case SyncAction.CREATE:
          const exists = await this.db.timerOptions.get(payload.uuid);
          if (exists) return;
          await this.db.timerOptions.put(payload);
          break;
        case SyncAction.UPDATE:
          await this.db.timerOptions.put(payload);
          break;
        case SyncAction.DELETE:
          await this.db.timerOptions.delete(payload.uuid);
          break;
        default:
          return;
      }
      await this.loadOptions();
    } catch (error) {
      console.error(error);
    }
  }

  async loadOptions() {
    try {
      const allOptions = await this.db.timerOptions.toArray();
      allOptions.sort((a, b) => a.value - b.value);
      this.options.set(allOptions);
    } catch (error) {
      console.error(error);
    }
  }

  async save(request: CreateTimerOptionRequest) {
    const newOption: TimerOption = { ...request, deleted: false };

    await this.db.transaction('rw', this.db.timerOptions, this.db.syncQueue, async () => {
      await this.db.timerOptions.add(newOption);
      await this.db.syncQueue.add({
        entityId: request.uuid,
        entityType: 'TIMER_OPTION',
        action: 'CREATE',
        payload: request,
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
    });

    await this.loadOptions();
    this.processSyncQueue();
  }

  async update(uuid: string, request: UpdateTimerOptionRequest) {
    const existingOption = await this.db.timerOptions.get(uuid);
    if (!existingOption) return;

    const updatedOption: TimerOption = {
      ...existingOption,
      ...request
    };

    await this.db.transaction('rw', this.db.timerOptions, this.db.syncQueue, async () => {
      await this.db.timerOptions.put(updatedOption);
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'TIMER_OPTION',
        action: 'UPDATE',
        payload: request,
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
    });

    await this.loadOptions();
    this.processSyncQueue();
  }

  async delete(uuid: string) {
    await this.db.transaction('rw', this.db.timerOptions, this.db.syncQueue, async () => {
      await this.db.timerOptions.delete(uuid);
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'TIMER_OPTION',
        action: 'DELETE',
        payload: { uuid },
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
    });

    await this.loadOptions();
    this.processSyncQueue();
  }

  private async processSyncQueue() {
    if (!this.healthCheckService.isHealthy() || this.isSyncing) return;
    this.isSyncing = true;

    try {
      const queue = await this.db.syncQueue
        .where('status').equals('PENDING')
        .and(item => item.entityType === 'TIMER_OPTION')
        .toArray();

      for (const item of queue) {
        try {
          if (item.action === 'CREATE') {
            await firstValueFrom(this.optionsApi.create(this.optionsApiUrl, item.payload));
          } else if (item.action === 'UPDATE') {
            await firstValueFrom(this.optionsApi.update(this.optionsApiUrl, item.entityId, item.payload));
          } else if (item.action === 'DELETE') {
            await firstValueFrom(this.optionsApi.delete(this.optionsApiUrl, item.entityId));
          }
          await this.db.syncQueue.delete(item.id!);
        } catch (error: any) {
          const shouldBreak = await this.handleSyncError(item, error);
          if (shouldBreak) break;
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async handleSyncError(item: any, error: any): Promise<boolean> {
    if (error instanceof HttpErrorResponse) {
      const isRecoverable = error.status === 429 || error.status >= 500 || error.status === 0;

      if (isRecoverable) {
        await this.db.syncQueue.update(item.id!, {
          status: 'ERROR',
          retries: (item.retries || 0) + 1,
          lastError: `HTTP ${error.status}: ${error.message}`
        });
        return true;
      }
    }
    await this.db.syncQueue.delete(item.id!);
    return false;
  }
}
