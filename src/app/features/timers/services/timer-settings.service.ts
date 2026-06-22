import {Injectable, signal, inject, OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Subscription, firstValueFrom} from 'rxjs';
import {TimerSetting, TimerSettingRequest} from '../models/timer-setting.model';
import {SyncMessage} from '../../../core/netwrok/sync-message.model';
import {environment} from '../../../../environments/environment';
import {AppDB} from '../../../core/db/app.db';

@Injectable({providedIn: 'root'})
export class TimerSettingsService implements OnDestroy {
  private http = inject(HttpClient);
  private db = inject(AppDB);
  private subscriptions = new Subscription();

  private baseUrl: string = environment.base_url;

  public activeSetting = signal<TimerSetting>(this.createInitialTimerSetting());

  constructor() {
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

      let syncUrl = `${this.baseUrl}/api/v1/timer-settings/sync`;
      if (latestUpdatedAt) {
        syncUrl += `?updatedAfter=${latestUpdatedAt}`;
      }

      const sub = this.http.get<TimerSetting>(syncUrl, {observe: 'response'}).subscribe({
        next: async (response) => {
          const setting = response.body;
          if (setting) {
            this.activeSetting.set(setting);
            await this.db.timerSettings.put(setting);
          }
        },
        error: (error) => console.warn('[TimerSettingsService] Backend unreachable or sync failed.', error)
      });

      this.subscriptions.add(sub);
    } catch (err) {
      console.error('[TimerSettingsService] Failed to load settings from DB:', err);
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

      const request: TimerSettingRequest = {
        uuid: updatedSetting.uuid,
        timerOptionUuid: timerOptionUuid,
        createdAt: updatedSetting.createdAt,
        updatedAt: now
      };

      await firstValueFrom(
        this.http.put<TimerSetting>(`${this.baseUrl}/api/v1/timer-settings`, request)
      );

      await this.db.syncQueue.delete(syncId);

    } catch (error) {
      console.warn('[TimerSettingsService] Backend sync failed. Action safely stored in offline queue.');
    }
  }

  async handleIncomingSync(incomingMessage: SyncMessage<TimerSetting>): Promise<void> {
    if (!incomingMessage || !incomingMessage.payload) return;

    const incomingSetting = incomingMessage.payload;
    const currentSetting = this.activeSetting();

    const isNewer = new Date(incomingSetting.updatedAt).getTime() > new Date(currentSetting.updatedAt).getTime();

    if (isNewer && !incomingSetting.deleted) {
      this.activeSetting.set(incomingSetting);
      await this.db.timerSettings.put(incomingSetting);
    }
  }

  private createInitialTimerSetting(): TimerSetting {
    const NOW = new Date().toISOString();

    return {
      uuid: crypto.randomUUID(),
      timerOptionUuid: crypto.randomUUID(),
      createdAt: NOW,
      updatedAt: NOW,
      deleted: false
    };
  }

}
