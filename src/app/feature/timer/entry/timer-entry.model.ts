export interface TimerEntry {
  id: number;
  labelId: number;
  durationSeconds: number;
  startTime: number;
}

export interface TimerEntryRequest {
  labelId: number;
  durationSeconds: number;
  startTime: number;
}
