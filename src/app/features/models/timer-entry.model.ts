export interface TimerEntry {
  id: number;
  labelId: number;
  durationSeconds: number;
  startTime: number;
  label?: {
    name: string;
    color: string;
  };
}

export interface TimerEntryRequest {
  labelId: number;
  durationSeconds: number;
  startTime: number;
}
