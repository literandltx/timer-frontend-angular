export interface TimerSetting {
  uuid: string;
  timerOptionUuid: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface TimerSettingRequest {
  uuid: string;
  timerOptionUuid: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimerSettingSyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE';
  payload?: unknown;
  settingUuid?: string;
}
