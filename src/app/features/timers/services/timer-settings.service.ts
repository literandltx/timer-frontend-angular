import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { TimerSetting, TimerSettingRequest } from '../models/timer-setting.model';
import { WebSocketCoreService } from '../../../core/netwrok/websocket.service';
import { SyncMessage, SyncAction } from '../../../core/netwrok/sync-message.model';
import { AppDB } from '../../../core/db/app.db';
import { AuthService } from '../../../core/auth/auth.service';
import { TimerSettingsApiService } from './timer-settings-api.service';
import { HealthCheckService } from '../../../core/netwrok/health.service';
import { TimerOptionsService } from './timer-options.service';

@Injectable({ providedIn: 'root' })
export class TimerSettingsService implements OnDestroy {
  private baseUrl = 'http://localhost:8080';
  private settingsApiUrl = 'http://localhost:8080/api/v1/timer-settings';
  private lastSyncKey = 'last_timer_settings_sync_time';

  private db: AppDB = inject(AppDB);
  private authService: AuthService = inject(AuthService);
  private settingsApi: TimerSettingsApiService = inject(TimerSettingsApiService);
  private webSocket: WebSocketCoreService = inject(WebSocketCoreService);
  private healthCheckService: HealthCheckService = inject(HealthCheckService);
  private timerOptionsService: TimerOptionsService = inject(TimerOptionsService);

  private isSyncing = false;
  private wsSubscription?: Subscription;

  public activeSetting = signal<TimerSetting | null>(null);

  constructor() {
    this.loadSettings();
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

      this.wsSubscription = this.webSocket.watch<SyncMessage<TimerSetting>>('/user/queue/timer-settings').subscribe({
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

      const updatedSettings = await firstValueFrom(
        this.settingsApi.pullUpdates(this.settingsApiUrl, lastSyncTime)
      );

      if (updatedSettings && updatedSettings.length > 0) {
        updatedSettings.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        const latestSetting = updatedSettings[0];

        await this.db.transaction('rw', this.db.timerSettings, async () => {
          await this.db.timerSettings.clear();
          if (!latestSetting.deleted) {
            await this.db.timerSettings.add(latestSetting);
          }
        });
        await this.loadSettings();
      }

      localStorage.setItem(this.lastSyncKey, new Date().toISOString());
    } catch (error) {
      console.error(error);
    }
  }

  async handleIncomingSync(incomingMessage: SyncMessage<TimerSetting>) {
    const action = incomingMessage.action;
    const payload = incomingMessage.payload;

    try {
      switch (action) {
        case SyncAction.CREATE:
        case SyncAction.UPDATE:
          await this.db.timerSettings.clear();
          await this.db.timerSettings.put(payload);
          break;
        case SyncAction.DELETE:
          await this.db.timerSettings.clear();
          break;
        default:
          return;
      }
      await this.loadSettings();
    } catch (error) {
      console.error(error);
    }
  }

  async loadSettings() {
    try {
      const setting = await this.db.timerSettings.toCollection().first();

      if (setting) {
        this.activeSetting.set(setting);
      } else {
        const options = this.timerOptionsService.options();
        if (options.length > 0) {
          await this.setActiveOption(options[0].uuid);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  async setActiveOption(timerOptionUuid: string) {
    let currentSetting = this.activeSetting();

    if (!currentSetting) {
      currentSetting = await this.db.timerSettings.toCollection().first() || null;
    }

    const now = new Date().toISOString();

    if (!currentSetting) {
      const newSetting: TimerSetting = {
        uuid: crypto.randomUUID(),
        timerOptionUuid,
        createdAt: now,
        updatedAt: now,
        deleted: false
      };

      await this.db.transaction('rw', this.db.timerSettings, this.db.syncQueue, async () => {
        await this.db.timerSettings.clear();
        await this.db.timerSettings.add(newSetting);
        await this.db.syncQueue.add({
          entityId: newSetting.uuid,
          entityType: 'TIMER_SETTING',
          action: 'CREATE',
          payload: {
            uuid: newSetting.uuid,
            timerOptionUuid: newSetting.timerOptionUuid,
            createdAt: newSetting.createdAt,
            updatedAt: newSetting.updatedAt
          },
          timestamp: Date.now(),
          status: 'PENDING',
          retries: 0
        });
      });
    } else {
      const updatedSetting: TimerSetting = {
        ...currentSetting,
        timerOptionUuid,
        updatedAt: now
      };

      await this.db.transaction('rw', this.db.timerSettings, this.db.syncQueue, async () => {
        await this.db.timerSettings.clear();
        await this.db.timerSettings.put(updatedSetting);
        await this.db.syncQueue.add({
          entityId: updatedSetting.uuid,
          entityType: 'TIMER_SETTING',
          action: 'UPDATE',
          payload: {
            uuid: updatedSetting.uuid,
            timerOptionUuid: updatedSetting.timerOptionUuid,
            createdAt: updatedSetting.createdAt,
            updatedAt: updatedSetting.updatedAt
          },
          timestamp: Date.now(),
          status: 'PENDING',
          retries: 0
        });
      });
    }

    await this.loadSettings();
    this.processSyncQueue();
  }

  private async processSyncQueue() {
    if (!this.healthCheckService.isHealthy() || this.isSyncing) return;
    this.isSyncing = true;

    try {
      const queue = await this.db.syncQueue
        .where('status').equals('PENDING')
        .and(item => item.entityType === 'TIMER_SETTING')
        .toArray();

      for (const item of queue) {
        try {
          if (item.action === 'CREATE') {
            await firstValueFrom(this.settingsApi.create(this.settingsApiUrl, item.payload));
          } else if (item.action === 'UPDATE') {
            await firstValueFrom(this.settingsApi.update(this.settingsApiUrl, item.entityId, item.payload));
          } else if (item.action === 'DELETE') {
            await firstValueFrom(this.settingsApi.delete(this.settingsApiUrl, item.entityId));
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
