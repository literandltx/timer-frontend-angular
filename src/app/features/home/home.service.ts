import {Injectable, inject, computed} from '@angular/core';
import {LabelService} from '../../core/services/label.service';
import {Label} from '../../core/models/label.model';
import {TimerPresetService} from '../../core/services/timer-preset.service';

@Injectable()
export class HomeService {
  private labelService = inject(LabelService);
  private presetService = inject(TimerPresetService);

  public activeLabelUuid = computed(() => {
    const labels: Label[] = this.labelService.labels();
    const currentId: string | undefined = this.presetService.activePreset().labelUuid;

    if (labels.length === 0) {
      return undefined;
    }

    const exists: boolean = labels.some(l => l.uuid === currentId);
    return exists ? currentId : labels[0].uuid;
  });

  public setActiveLabel(id: string | undefined): void {
    if (!id) {
      return;
    }

    this.presetService.setActiveLabel(id);
  }

}
