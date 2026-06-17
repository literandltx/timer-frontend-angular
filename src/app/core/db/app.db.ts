import {Injectable} from '@angular/core';
import {Dexie, Table} from 'dexie';
import {Label} from '../../features/labels/models/label.model';
import {TimerOption} from '../../features/timers/models/timer-option.model';
import {TimerSetting} from '../../features/timers/models/timer-setting.model';

export type EntityType = 'LABEL' | 'TIMER_OPTION' | 'TIMER_ENTRY' | 'TIMER_SETTING';

export interface SyncAction {
  id?: number;
  entityId: string;
  entityType: EntityType;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: any;

  timestamp: number;
  status?: 'PENDING' | 'ERROR';
  retries?: number;
  lastError?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppDB extends Dexie {
  labels!: Table<Label, string>;
  timerOptions!: Table<TimerOption, string>;
  timerSettings!: Table<TimerSetting, string>;
  syncQueue!: Table<SyncAction, number>;

  constructor() {
    super('TimerDB');

    this.version(1).stores({
      labels: 'uuid, name, color, createdAt, updatedAt',
      syncQueue: '++id, timestamp'
    });

    this.version(2).stores({
      timerOptions: 'uuid, value, createdAt, updatedAt',
      timerSettings: 'uuid, timerOptionUuid, createdAt, updatedAt',
      syncQueue: '++id, timestamp, status, entityType'
    });
  }
}
