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
    ACTIVE_TIMER_SETTING: 'app_active_timer_setting'
  };

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

  resetContext(): void {
    this.storage.remove(this.KEYS.ACTIVE_LABEL_UUID);
    this.storage.remove(this.KEYS.ACTIVE_TIMER_SETTING);
  }
}
