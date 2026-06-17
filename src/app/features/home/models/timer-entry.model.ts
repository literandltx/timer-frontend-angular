import {CreateLabelRequest} from '../../labels/models/label.model';

export interface TimerEntry {
  uuid: string;

  labelUuid: string;
  durationSeconds: number;
  startTime: number;

  label?: {
    name: string;
    color: string;
  };
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface CreateTimerEntryRequest {
  uuid: string;
  labelUuid: string;
  durationSeconds: number;
  startTime: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTimerEntryRequest {
  labelUuid: string;
  durationSeconds: number;
  startTime: number;
  updatedAt: string;
}

export interface TimerEntrySyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: any;
  entryUuid?: string;
}
