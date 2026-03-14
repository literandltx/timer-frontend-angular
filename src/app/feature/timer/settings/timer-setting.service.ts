import {Injectable, signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {TimerOption, TimerSetting} from './timer-setting.model';
import {BaseOfflineSyncService} from '../../../core/utils/base-offline-sync.service';

interface SyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'SET_ACTIVE';
  payload?: { value?: number; timerOptionId?: number };
  optionId?: number;
  tempId?: number;
  settingId?: number;
}

const STORAGE_KEYS = {
  OPTIONS: 'timer_options',
  ACTIVE_SETTING: 'active_timer_setting'
} as const;

@Injectable({providedIn: 'root'})
export class TimerSettingService extends BaseOfflineSyncService<SyncAction> {
  protected pingUrl = 'http://localhost:8080/api/v1/timer-options';
  protected queueKey = 'timer_queue';

  private readonly optionsUrl = 'http://localhost:8080/api/v1/timer-options';
  private readonly settingsUrl = 'http://localhost:8080/api/v1/timer-settings';

  options = signal<TimerOption[]>([]);
  activeSetting = signal<TimerSetting | null>(null);

  loadData() {
    this.options.set(this.getLocalOptions());
    const localSetting = localStorage.getItem(STORAGE_KEYS.ACTIVE_SETTING);

    if (localSetting) {
      this.activeSetting.set(JSON.parse(localSetting));
    } else {
      const firstOption = this.options()[0];
      if (firstOption) {
        this.updateActiveLocalState({id: -1, timerOptionId: firstOption.id});
      }
    }

    if (this.isOnline() && this.getQueue().length === 0 && this.authService.isAuthenticated()) {
      this.fetchInitialServerData();
    }
  }

  async setActiveOption(timerOptionId: number) {
    const settingId = this.activeSetting()?.id || -1;
    this.updateActiveLocalState({id: settingId, timerOptionId});

    const queue = this.getQueue();
    const existingSyncIndex = queue.findIndex(a => a.type === 'SET_ACTIVE');

    if (existingSyncIndex > -1) {
      queue[existingSyncIndex].payload = {timerOptionId};
      this.setQueue(queue);
      this.syncQueue();
    } else {
      this.enqueueAction({
        type: 'SET_ACTIVE',
        settingId,
        payload: {timerOptionId}
      });
    }
  }

  async saveOption(value: number) {
    const tempId = -Date.now();
    this.updateLocalOptionsState(opts => [...opts, {id: tempId, value}]);
    this.enqueueAction({type: 'CREATE', payload: {value}, tempId});
  }

  async updateOption(id: number, value: number) {
    this.updateLocalOptionsState(opts => opts.map(o => o.id === id ? {...o, value} : o));

    const queue = this.getQueue();
    const pending = queue.find(a => a.type === 'CREATE' && a.tempId === id);

    if (pending && pending.payload) {
      pending.payload.value = value;
      this.setQueue(queue);
    } else {
      this.enqueueAction({type: 'UPDATE', optionId: id, payload: {value}});
    }
  }

  async deleteOption(id: number) {
    this.updateLocalOptionsState(opts => opts.filter(o => o.id !== id));
    const queue = this.getQueue();

    if (id < 0) {
      this.setQueue(queue.filter(a => !(a.tempId === id || a.optionId === id)));
    } else {
      this.enqueueAction({type: 'DELETE', optionId: id});
    }
  }

  protected async syncQueue() {
    if (!this.isOnline() || this.isSyncing() || !this.authService.isAuthenticated()) return;

    this.isSyncing.set(true);

    try {
      while (true) {
        const queue = this.getQueue();
        if (queue.length === 0) break;

        const action = queue[0];

        try {
          if (action.type === 'CREATE') {
            const saved = await firstValueFrom(this.http.post<TimerOption>(this.optionsUrl, action.payload));
            this.replaceLocalId(action.tempId!, saved.id);
            this.updateQueueIds(action.tempId!, saved.id);
          } else if (action.type === 'UPDATE') {
            await firstValueFrom(this.http.put<TimerOption>(`${this.optionsUrl}/${action.optionId}`, action.payload));
          } else if (action.type === 'DELETE') {
            await firstValueFrom(this.http.delete<void>(`${this.optionsUrl}/${action.optionId}`));
          } else if (action.type === 'SET_ACTIVE') {
            if (action.settingId && action.settingId > 0) {
              await firstValueFrom(this.http.put<TimerSetting>(`${this.settingsUrl}/${action.settingId}`, action.payload));
            } else {
              const saved = await firstValueFrom(this.http.post<TimerSetting>(this.settingsUrl, action.payload));
              const current = this.activeSetting();
              if (current && current.timerOptionId === saved.timerOptionId) {
                this.updateActiveLocalState(saved);
              }
            }
          }

          this.removeActionFromQueue(action.id);

        } catch (err: any) {
          if (err.status === 0 || err.status === 429 || err.status >= 500) {
            if (err.status !== 429) this.isOnline.set(false);
            break;
          }
          this.removeActionFromQueue(action.id);
        }
      }
    } finally {
      this.isSyncing.set(false);
    }
  }

  private fetchInitialServerData() {
    this.http.get<TimerOption[]>(this.optionsUrl).subscribe(data => {
      if (data?.length) {
        this.setLocalOptions(data);
        this.options.set(data);
      }
    });
    this.http.get<TimerSetting[]>(this.settingsUrl).subscribe(data => {
      if (data?.length) {
        this.updateActiveLocalState(data[0]);
      }
    });
  }

  private updateLocalOptionsState(updateFn: (opts: TimerOption[]) => TimerOption[]) {
    const updated = updateFn(this.getLocalOptions());
    this.setLocalOptions(updated);
    this.options.set(updated);
  }

  private updateActiveLocalState(setting: TimerSetting) {
    this.activeSetting.set(setting);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SETTING, JSON.stringify(setting));
  }

  private initDefaultOptions(): TimerOption[] {
    const timestamp = Date.now();
    const defaults: TimerOption[] = [
      {id: -timestamp, value: 20},
      {id: -(timestamp + 1), value: 45},
      {id: -(timestamp + 2), value: 60}
    ];

    this.setLocalOptions(defaults);

    defaults.forEach(opt => {
      this.enqueueAction({
        type: 'CREATE',
        payload: {value: opt.value},
        tempId: opt.id
      });
    });

    return defaults;
  }

  private getLocalOptions(): TimerOption[] {
    const storedOptions = localStorage.getItem(STORAGE_KEYS.OPTIONS);
    if (storedOptions) {
      const parsedOptions = JSON.parse(storedOptions);
      if (parsedOptions.length > 0) return parsedOptions;
    }
    return this.initDefaultOptions();
  }

  private setLocalOptions(opts: TimerOption[]) {
    localStorage.setItem(STORAGE_KEYS.OPTIONS, JSON.stringify(opts));
  }

  private replaceLocalId(oldId: number, newId: number) {
    this.updateLocalOptionsState(opts => opts.map(o => o.id === oldId ? {...o, id: newId} : o));
  }

  private updateQueueIds(oldId: number, newId: number) {
    const queue = this.getQueue();
    let changed = false;

    queue.forEach(a => {
      if (a.optionId === oldId) {
        a.optionId = newId;
        changed = true;
      }
      if (a.type === 'SET_ACTIVE' && a.payload?.timerOptionId === oldId) {
        a.payload.timerOptionId = newId;
        changed = true;
      }
    });

    if (changed) this.setQueue(queue);
  }

  private removeActionFromQueue(actionId: string) {
    const currentQueue = this.getQueue();
    this.setQueue(currentQueue.filter(a => a.id !== actionId));
  }
}
