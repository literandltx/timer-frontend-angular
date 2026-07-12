import {Injectable, signal, inject, OnDestroy} from '@angular/core';
import {Subscription, firstValueFrom} from 'rxjs';
import {TimerSetting, TimerSettingRequest} from '../models/timer-setting.model';
import {SyncMessage} from '../../../core/netwrok/sync-message.model';
import {AppDB} from '../../../core/db/app.db';
import {AuthService} from '../../../core/auth/auth.service';
import {TimerSettingApiService} from './timer-setting-api.service';
import {LogService} from '../../../core/log/log.service';
import {TimerSettingStorageService} from '../../../core/storage/timer-setting-storage.service';

@Injectable({providedIn: 'root'})
export class TimerSettingsService implements OnDestroy {
  private api = inject(TimerSettingApiService);
  private db = inject(AppDB);
  private auth = inject(AuthService);
  private log = inject(LogService);
  private settingStorage = inject(TimerSettingStorageService);
  private subscriptions = new Subscription();

  public activeSetting = signal<TimerSetting>(this.settingStorage.activeSetting ?? this.createLocalDefault());

  constructor() {
    this.loadSettings();
  }

  async loadSettings(): Promise<void> {
    try {
      const localSettings = await this.db.timerSettings.toArray();
      let latestUpdatedAt: string | undefined;

      if (localSettings.length > 0) {
        const latest = localSettings.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];

        const current = this.activeSetting();
        if (!current.updatedAt || new Date(latest.updatedAt).getTime() >= new Date(current.updatedAt).getTime()) {
          this.setActiveSetting(latest);
        }
        latestUpdatedAt = latest.updatedAt;
      } else {
        await this.db.timerSettings.put(this.activeSetting());
      }

      if (this.auth.isAuthenticatedSignal()) {
        const sub = this.api.pullUpdates(latestUpdatedAt).subscribe({
          next: async (response) => {
            if (response) {
              const current = this.activeSetting();
              const isNewer = !current.updatedAt ||
                new Date(response.updatedAt).getTime() > new Date(current.updatedAt).getTime();

              if (isNewer) {
                this.setActiveSetting(response);
                await this.db.timerSettings.put(response);
              }
            }
          },
          error: (error) => {
            this.log.warn('[TimerSettingsService] Sync failed.', error);
          }
        });

        this.subscriptions.add(sub);
      }
    } catch (err) {
      this.log.error('[TimerSettingsService] Failed to load settings from DB:', err);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async setActiveOption(timerOptionUuid: string): Promise<void> {
    const currentSetting = this.activeSetting();
    const now = new Date().toISOString();
    const updatedSetting: TimerSetting = {
      ...currentSetting,
      uuid: currentSetting.uuid ?? this.generateUuid(),
      createdAt: currentSetting.createdAt ?? now,
      timerOptionUuid: timerOptionUuid,
      updatedAt: now
    };

    this.setActiveSetting(updatedSetting);

    try {
      await this.db.timerSettings.put(updatedSetting);

      const syncId = await this.db.syncQueue.add({
        entityId: updatedSetting.uuid,
        entityType: 'TIMER_SETTING',
        action: 'UPDATE',
        payload: updatedSetting,
        timestamp: Date.now(),
        status: 'PENDING'
      });

      if (!this.auth.isAuthenticatedSignal()) {
        this.log.error('User unauthenticated. Skipping HTTP call, kept in queue.');
        return;
      }

      const request: TimerSettingRequest = {
        uuid: updatedSetting.uuid,
        timerOptionUuid: timerOptionUuid,
        createdAt: updatedSetting.createdAt,
        updatedAt: now
      };

      await firstValueFrom(this.api.save(request));
      await this.db.syncQueue.delete(syncId);

    } catch (error) {
      this.log.info(`[TimerSettingsService] Action safely stored offline.`, error);
    }
  }

  async handleIncomingSync(incomingMessage: SyncMessage<TimerSetting>): Promise<void> {
    if (!incomingMessage || !incomingMessage.payload) {
      return;
    }

    const incomingSetting = incomingMessage.payload;
    const currentSetting = this.activeSetting();
    const isNewer = !currentSetting.updatedAt || new Date(incomingSetting.updatedAt).getTime() > new Date(currentSetting.updatedAt).getTime();

    if (isNewer && !incomingSetting.deleted) {
      this.setActiveSetting(incomingSetting);
      await this.db.timerSettings.put(incomingSetting);
    }
  }

  private setActiveSetting(setting: TimerSetting): void {
    this.activeSetting.set(setting);
    this.settingStorage.setActiveSetting(setting);
  }

  private createLocalDefault(): TimerSetting {
    const now = new Date().toISOString();
    return {
      uuid: this.generateUuid(),
      timerOptionUuid: undefined as unknown as string,
      createdAt: now,
      updatedAt: now
    } as TimerSetting;
  }

  private generateUuid(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

}
