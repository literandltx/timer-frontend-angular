export interface TimerOption {
  id: number;
  value: number;
}

export interface TimerSetting {
  id: number;
  timerOptionId: number;
  lastUpdated?: number;
}
