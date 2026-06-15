import {Injectable} from '@angular/core';
import {Dexie, Table} from 'dexie';
import {Label} from '../../features/labels/models/label.model';

export type EntityType = 'LABEL' | 'TIMER_OPTION' | 'TIMER_ENTRY' | 'TIMER_SETTINGS';

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
  syncQueue!: Table<SyncAction, number>;

  constructor() {
    super('TimerDB');

    this.version(1).stores({
      labels: 'uuid, name, color, createdAt, updatedAt',
      syncQueue: '++id, timestamp'
    });
  }
}
