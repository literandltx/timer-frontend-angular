import {inject, Injectable} from '@angular/core';
import {TimerSetting} from '../../features/timers/models/timer-setting.model';
import {StorageService} from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class TimerSettingStorageService {
  private readonly ACTIVE_SETTING = 'app_active_timer_setting';

  private storage: StorageService = inject(StorageService);

  get activeSetting(): TimerSetting | null {
    return this.storage.get<TimerSetting>(this.ACTIVE_SETTING);
  }

  setActiveSetting(setting: TimerSetting): void {
    this.storage.set(this.ACTIVE_SETTING, setting);
  }

  reset(): void {
    this.storage.remove(this.ACTIVE_SETTING);
  }
}
