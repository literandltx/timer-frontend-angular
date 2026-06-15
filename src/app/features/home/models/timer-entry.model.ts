export interface TimerEntry {
  id: number;
  labelUuid: string;
  durationSeconds: number;
  startTime: number;
  label?: {
    name: string;
    color: string;
  };
}

export interface TimerEntryRequest {
  labelUuid: string;
  durationSeconds: number;
  startTime: number;
}
