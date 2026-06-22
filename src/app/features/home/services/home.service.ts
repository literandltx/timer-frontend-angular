import {Injectable, inject, signal, computed} from '@angular/core';
import {LabelService} from '../../labels/services/label.service';
import {Label} from "../../labels/models/label.model";

@Injectable()
export class HomeService {
  private labelService = inject(LabelService);
  private rawLabelUuid = signal<string | undefined>(this.getSavedlabelUuid());

  public activeLabelUuid = computed(() => {
    const labels: Label[] = this.labelService.labels();
    const currentId: string | undefined = this.rawLabelUuid();

    if (labels.length === 0) {
      return undefined;
    }

    const exists: boolean = labels.some(l => l.uuid === currentId);
    return exists ? currentId : labels[0].uuid;
  });

  public setActiveLabel(id: string | undefined): void {
    this.rawLabelUuid.set(id);
    if (id !== undefined) {
      localStorage.setItem('activelabelUuid', id);
    } else {
      localStorage.removeItem('activelabelUuid');
    }
  }

  private getSavedlabelUuid(): string | undefined {
    const saved: string | null = localStorage.getItem('activelabelUuid');
    return saved ? saved : undefined;
  }
}
