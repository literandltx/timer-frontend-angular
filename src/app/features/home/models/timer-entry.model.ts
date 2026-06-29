export interface TimerEntry {
  uuid: string;

  labelId: string;
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
  labelId: string;
  durationSeconds: number;
  startTime: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTimerEntryRequest {
  labelId: string;
  durationSeconds: number;
  startTime: number;
  updatedAt: string;
}

export interface TimerEntrySyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: unknown;
  entryUuid?: string;
}
