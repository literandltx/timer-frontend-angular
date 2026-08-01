import { inject, Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { TimerPreset } from '../models/timer-setting.model';

@Injectable({
  providedIn: 'root'
})
export class UserContextStorageService {
  private storage: StorageService = inject(StorageService);

  private readonly KEYS = {
    ACTIVE_LABEL_UUID: 'app_active_label_uuid',
    ACTIVE_TIMER_SETTING: 'app_active_timer_setting',
    HAS_SESSION: 'hasSession'
  };

  private readonly SYNC_PREFIX: string = 'last_sync_';

  // --- Session State ---
  get hasSession(): boolean {
    return this.storage.get<boolean>(this.KEYS.HAS_SESSION) ?? false;
  }

  setHasSession(hasSession: boolean): void {
    this.storage.set(this.KEYS.HAS_SESSION, hasSession);
  }

  // --- Active Label ---
  get activeLabelUuid(): string | undefined {
    return this.storage.get<string>(this.KEYS.ACTIVE_LABEL_UUID) ?? undefined;
  }

  setActiveLabelUuid(uuid: string | undefined): void {
    if (uuid !== undefined) {
      this.storage.set(this.KEYS.ACTIVE_LABEL_UUID, uuid);
    } else {
      this.storage.remove(this.KEYS.ACTIVE_LABEL_UUID);
    }
  }

  // --- Timer Settings ---
  get activeTimerSetting(): TimerPreset | null {
    return this.storage.get<TimerPreset>(this.KEYS.ACTIVE_TIMER_SETTING);
  }

  setActiveTimerSetting(setting: TimerPreset): void {
    this.storage.set(this.KEYS.ACTIVE_TIMER_SETTING, setting);
  }

  // --- Sync Timestamps ---
  updateSyncTimestamp(entityType: string, timestamp?: string): void {
    this.storage.set(this.getSyncKey(entityType), timestamp ?? new Date().toISOString());
  }

  getSyncTimestamp(entityType: string): string | null {
    return this.storage.get<string>(this.getSyncKey(entityType));
  }

  clearSyncTimestamp(entityType: string): void {
    this.storage.remove(this.getSyncKey(entityType));
  }

  clearAllSyncTimestamps(): void {
    this.storage.removeByPrefix(this.SYNC_PREFIX);
  }

  private getSyncKey(entityType: string): string {
    return `${this.SYNC_PREFIX}${entityType.toLowerCase()}`;
  }

  // --- Utility ---
  resetContext(): void {
    this.storage.remove(this.KEYS.ACTIVE_LABEL_UUID);
    this.storage.remove(this.KEYS.ACTIVE_TIMER_SETTING);
    this.storage.remove(this.KEYS.HAS_SESSION);

    this.clearAllSyncTimestamps();
  }
}
