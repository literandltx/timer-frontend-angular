import {Injectable} from '@angular/core';
import {Dexie, Table} from 'dexie';
import {Label} from '../../features/labels/models/label.model';
import {TimerOption} from '../../features/timers/models/timer-option.model';
import {TimerSetting} from '../../features/timers/models/timer-setting.model';
import {TimerEntry} from '../../features/home/models/timer-entry.model';

export type EntityType = 'LABEL' | 'TIMER_OPTION' | 'TIMER_ENTRY' | 'TIMER_SETTING';
export type SyncActionType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncAction {
  id?: number;
  entityId: string;
  entityType: EntityType;
  action: SyncActionType;
  payload?: unknown;

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
  timerEntries!: Table<TimerEntry, string>;
  syncQueue!: Table<SyncAction, number>;

  constructor() {
    super('TimerDB');

    this.version(1).stores({
      labels: 'uuid, name, color, createdAt, updatedAt',
      timerOptions: 'uuid, value, createdAt, updatedAt',
      timerSettings: 'uuid, timerOptionUuid, createdAt, updatedAt',
      timerEntries: 'uuid, labelUuid, startTime, createdAt, updatedAt',
      syncQueue: '++id, timestamp, status, entityType'
    });
  }
}
