import {Injectable, signal, computed, inject, OnDestroy} from '@angular/core';
import {Subscription, firstValueFrom} from 'rxjs';
import {TimerPreset, TimerPresetRequest} from '../models/timer-setting.model';
import {SyncMessage} from '../netwrok/sync-message.model';
import {AppDB} from '../db/app.db';
import {AuthService} from '../auth/auth.service';
import {TimerPresetApiService} from './api/timer-preset-api.service';
import {LogService} from '../log/log.service';
import {TimerSettingStorageService} from '../storage/timer-setting-storage.service';
import {LabelService} from './label.service';

@Injectable({providedIn: 'root'})
export class TimerPresetService implements OnDestroy {
  private api = inject(TimerPresetApiService);
  private db = inject(AppDB);
  private auth = inject(AuthService);
  private log = inject(LogService);
  private settingStorage = inject(TimerSettingStorageService);
  private labelService = inject(LabelService);
  private subscriptions = new Subscription();

  public activePreset = signal<TimerPreset>(this.settingStorage.activeSetting ?? this.createLocalDefault());

  public activeLabelUuid = computed<string | undefined>(() => {
    const labels = this.labelService.labels();
    const currentId = this.activePreset().labelUuid;

    if (labels.length === 0) {
      return undefined;
    }

    const exists = labels.some(l => l.uuid === currentId);
    return exists ? currentId : labels[0].uuid;
  });

  constructor() {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async loadSettings(): Promise<void> {
    try {
      const localSettings = await this.db.timerSettings.toArray();
      let latestUpdatedAt: string | undefined;

      if (localSettings.length > 0) {
        const latest = localSettings.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];

        const current = this.activePreset();
        if (!current.updatedAt || new Date(latest.updatedAt).getTime() >= new Date(current.updatedAt).getTime()) {
          this.setActiveSetting(latest);
        }
        latestUpdatedAt = latest.updatedAt;
      } else {
        await this.db.timerSettings.put(this.activePreset());
      }

      if (this.auth.isAuthenticatedSignal()) {
        const sub = this.api.pullUpdates(latestUpdatedAt).subscribe({
          next: async (response) => {
            if (response) {
              const current = this.activePreset();
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

  async setActiveTimerOption(timerOptionUuid: string): Promise<void> {
    await this.updateActivePreset({timerOptionUuid});
  }

  async setActiveLabel(labelUuid: string): Promise<void> {
    await this.updateActivePreset({labelUuid});
  }

  private async updateActivePreset(
    partial: Partial<Pick<TimerPreset, 'labelUuid' | 'timerOptionUuid'>>
  ): Promise<void> {
    const currentSetting = this.activePreset();
    const now = new Date().toISOString();
    const updatedSetting: TimerPreset = {
      ...currentSetting,
      uuid: currentSetting.uuid ?? crypto.randomUUID(),
      createdAt: currentSetting.createdAt ?? now,
      updatedAt: now
    };

    if (partial.labelUuid !== undefined) {
      updatedSetting.labelUuid = partial.labelUuid;
    }

    if (partial.timerOptionUuid !== undefined) {
      updatedSetting.timerOptionUuid = partial.timerOptionUuid;
    }

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

      const request: TimerPresetRequest = {
        uuid: updatedSetting.uuid,
        labelUuid: updatedSetting.labelUuid,
        timerOptionUuid: updatedSetting.timerOptionUuid,
        createdAt: updatedSetting.createdAt,
        updatedAt: now
      };

      await firstValueFrom(this.api.save(request));
      await this.db.syncQueue.delete(syncId);

    } catch (error) {
      this.log.info(`[TimerSettingsService] Action safely stored offline.`, error);
    }
  }

  async handleIncomingSync(incomingMessage: SyncMessage<TimerPreset>): Promise<void> {
    if (!incomingMessage || !incomingMessage.payload) {
      return;
    }

    const incomingSetting = incomingMessage.payload;
    const currentSetting = this.activePreset();
    const isNewer = !currentSetting.updatedAt || new Date(incomingSetting.updatedAt).getTime() > new Date(currentSetting.updatedAt).getTime();

    if (isNewer && !incomingSetting.deleted) {
      this.setActiveSetting(incomingSetting);
      await this.db.timerSettings.put(incomingSetting);
    }
  }

  private setActiveSetting(setting: TimerPreset): void {
    this.activePreset.set(setting);
    this.settingStorage.setActiveSetting(setting);
  }

  private createLocalDefault(): TimerPreset {
    const now = new Date().toISOString();
    return {
      uuid: crypto.randomUUID(),
      labelUuid: undefined as unknown as string,
      timerOptionUuid: undefined as unknown as string,
      createdAt: now,
      updatedAt: now,
      deleted: false
    } as TimerPreset;
  }

}
