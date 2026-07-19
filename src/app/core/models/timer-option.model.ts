export interface TimerOption {
  uuid: string;
  value: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface CreateTimerOptionRequest {
  uuid: string;
  value: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTimerOptionRequest {
  value: number;
  updatedAt: string;
}

export interface TimerOptionSyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: unknown;
  optionUuid?: string;
}
