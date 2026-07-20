import {inject, Injectable} from '@angular/core';
import {TimerPreset} from '../models/timer-setting.model';
import {StorageService} from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class TimerSettingStorageService {
  private readonly ACTIVE_SETTING = 'app_active_timer_setting';

  private storage: StorageService = inject(StorageService);

  get activeSetting(): TimerPreset | null {
    return this.storage.get<TimerPreset>(this.ACTIVE_SETTING);
  }

  setActiveSetting(setting: TimerPreset): void {
    this.storage.set(this.ACTIVE_SETTING, setting);
  }

  reset(): void {
    this.storage.remove(this.ACTIVE_SETTING);
  }
}
