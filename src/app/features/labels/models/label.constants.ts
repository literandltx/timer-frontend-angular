import {CreateLabelRequest} from './label.model';

export const DEFAULT_LABELS: Partial<CreateLabelRequest>[] = [
  {
    uuid: 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
    name: 'Work',
    color: '#ef4444',
  },
  {
    uuid: 'b2c3d4e5-f6a7-4b2c-9d3e-234567890abc',
    name: 'Study',
    color: '#3b82f6',
  },
  {
    uuid: 'c3d4e5f6-a7b8-4c3d-ae4f-34567890abcd',
    name: 'Chill',
    color: '#10b981',
  },
];
