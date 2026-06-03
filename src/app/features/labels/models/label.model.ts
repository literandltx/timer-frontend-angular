export interface Label {
  id: number;
  userId: number;
  name: string;
  color: string;
}

export interface CreateLabelRequest {
  name: string;
  color: string;
}
