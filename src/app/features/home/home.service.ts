import {Injectable, inject} from '@angular/core';
import {TimerPresetService} from '../../core/services/timer-preset.service';

@Injectable()
export class HomeService {
  private presetService = inject(TimerPresetService);

  public activeLabelUuid = this.presetService.activeLabelUuid;

}
