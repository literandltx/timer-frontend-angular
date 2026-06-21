import {CreateTimerOptionRequest} from './timer-option.model';

export const DEFAULT_TIMER_OPTIONS: Partial<CreateTimerOptionRequest>[] = [
  {
    uuid: 'f1a2b3c4-d5e6-4f7a-8b9c-0123456789ab',
    value: 20
  },
  {
    uuid: 'e2b3c4d5-a6f7-4e8b-9c0d-123456789abc',
    value: 45
  },
  {
    uuid: 'd3c4d5e6-b7a8-4d9c-0d1e-23456789abcd',
    value: 60
  },
];
