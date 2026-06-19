import {Injectable, signal, inject, OnDestroy} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {TimerSetting, TimerSettingRequest} from '../models/timer-setting.model';
import {SyncMessage, SyncAction} from '../../../core/netwrok/sync-message.model';
import {TimerOption} from '../models/timer-option.model';

@Injectable({providedIn: 'root'})
export class TimerSettingsService implements OnDestroy {

  public activeSetting = signal<TimerSetting>(this.createInitialTimerSetting());

  constructor() {}

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

  loadSettings() {

  }

  ngOnDestroy() {

  }

  async setActiveOption(timerOptionUuid: string) {

  }

  async handleIncomingSync(incomingMessage: SyncMessage<TimerSetting>) {

  }

}
