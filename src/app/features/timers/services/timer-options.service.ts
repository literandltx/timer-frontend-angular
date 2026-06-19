import {Injectable, signal, inject, OnDestroy} from '@angular/core';
import {
  TimerOption,
  CreateTimerOptionRequest,
  UpdateTimerOptionRequest
} from '../models/timer-option.model';
import {SyncMessage, SyncAction} from '../../../core/netwrok/sync-message.model';

@Injectable({providedIn: 'root'})
export class TimerOptionsService implements OnDestroy {

  public options = signal<TimerOption[]>([]);

  constructor() {
  }

  ngOnDestroy() {
  }

  async handleIncomingSync(incomingMessage: SyncMessage<TimerOption>) {
  }

  loadOptions(){
  }

  async save(request: CreateTimerOptionRequest) {
  }

  async update(uuid: string, request: UpdateTimerOptionRequest) {
  }

  async delete(uuid: string) {
  }

}
