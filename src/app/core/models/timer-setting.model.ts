export interface TimerPreset {
  uuid: string;
  labelUuid: string;
  timerOptionUuid: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface TimerPresetRequest {
  uuid: string;
  labelUuid: string;
  timerOptionUuid: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimerPresetSyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE';
  payload?: unknown;
  presetUuid?: string;
}
