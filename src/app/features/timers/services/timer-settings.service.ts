import {Injectable, signal, inject, OnDestroy} from '@angular/core';
import {Subscription, firstValueFrom} from 'rxjs';
import {TimerSetting, TimerSettingRequest} from '../models/timer-setting.model';
import {SyncMessage} from '../../../core/netwrok/sync-message.model';
import {AppDB} from '../../../core/db/app.db';
import {AuthService} from '../../../core/auth/auth.service';
import {TimerSettingApiService} from './timer-setting-api.service';

@Injectable({providedIn: 'root'})
export class TimerSettingsService implements OnDestroy {
  private api = inject(TimerSettingApiService);
  private db = inject(AppDB);
  private auth = inject(AuthService);
  private subscriptions = new Subscription();

  public activeSetting = signal<TimerSetting>({} as TimerSetting);

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

        this.activeSetting.set(latest);
        latestUpdatedAt = latest.updatedAt;
      }

      if (this.auth.isAuthenticatedSignal()) {
        const sub = this.api.pullUpdates(latestUpdatedAt).subscribe({
          next: async (response) => {
            if (response) {
              this.activeSetting.set(response);
              await this.db.timerSettings.put(response);
            }
          },
          error: (error) => {
            console.warn('[TimerSettingsService] Sync failed.', error);
          }
        });

        this.subscriptions.add(sub);
      }
    } catch (err) {
      console.error('[TimerSettingsService] Failed to load settings from DB:', err);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async setActiveOption(timerOptionUuid: string): Promise<void> {
    const currentSetting = this.activeSetting();

    if (!currentSetting.uuid) {
      return;
    }

    const now = new Date().toISOString();
    const updatedSetting: TimerSetting = {
      ...currentSetting,
      timerOptionUuid: timerOptionUuid,
      updatedAt: now
    };

    this.activeSetting.set(updatedSetting);

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
        console.error('User unauthenticated. Skipping HTTP call, kept in queue.');
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
      console.info(`[TimerSettingsService] Action safely stored offline.`, error);
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
      this.activeSetting.set(incomingSetting);
      await this.db.timerSettings.put(incomingSetting);
    }
  }
}
