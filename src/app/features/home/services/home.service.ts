import { Injectable, inject, signal, computed } from '@angular/core';
import { LabelService } from '../../labels/services/label.service';
import { Label } from "../../labels/models/label.model";

@Injectable()
export class HomeService {
  private labelService = inject(LabelService);
  private rawLabelId = signal<number | undefined>(this.getSavedLabelId());

  public activeLabelId = computed(() => {
    const labels: Label[] = this.labelService.labels();
    const currentId: number | undefined = this.rawLabelId();

    if (labels.length === 0) {
      return undefined;
    }

    const exists: boolean = labels.some(l => l.id === currentId);
    return exists ? currentId : labels[0].id;
  });

  public setActiveLabel(id: number | undefined): void {
    this.rawLabelId.set(id);
    if (id !== undefined) {
      localStorage.setItem('activeLabelId', id.toString());
    } else {
      localStorage.removeItem('activeLabelId');
    }
  }

  private getSavedLabelId(): number | undefined {
    const saved: string | null = localStorage.getItem('activeLabelId');
    return saved ? Number(saved) : undefined;
  }
}
