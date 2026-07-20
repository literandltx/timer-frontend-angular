import {Injectable, inject, signal, computed} from '@angular/core';
import {LabelService} from '../../core/services/label.service';
import {Label} from '../../core/models/label.model';
import {ActiveLabelStorageService} from '../../core/storage/active-label-storage.service';

@Injectable()
export class HomeService {
  private labelService = inject(LabelService);
  private activeLabelStorage = inject(ActiveLabelStorageService);
  private rawLabelUuid = signal<string | undefined>(this.activeLabelStorage.activeLabelUuid);

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
    this.activeLabelStorage.setActiveLabelUuid(id);
  }

}
