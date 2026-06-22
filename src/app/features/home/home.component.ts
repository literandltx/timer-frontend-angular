import {Component, OnInit, inject, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {TimerComponent} from './components/timer.component';
import {ToggleGroupComponent} from '../../shared/components/toggle/toggle-group.component';
import {ToggleButtonComponent} from '../../shared/components/toggle/toggle-button.component';

import {LabelService} from '../labels/services/label.service';
import {TimerSettingsService} from '../timers/services/timer-settings.service';
import {TimerOptionsService} from '../timers/services/timer-options.service';
import {TimerEntryService} from './services/timer-entry.service';
import {TitleBlinkerService} from '../../core/services/title-blinker.service';
import {HomeService} from './services/home.service';

@Component({
  selector: 'ns-app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TimerComponent, ToggleGroupComponent, ToggleButtonComponent],
  providers: [HomeService],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  public labelService = inject(LabelService);
  public settingService = inject(TimerSettingsService);
  public optionsService = inject(TimerOptionsService);
  public entryService = inject(TimerEntryService);
  public homeService = inject(HomeService);
  private blinkerService = inject(TitleBlinkerService);
  private isTimerFinished = false;

  activeLabelColor = computed(() => {
    const labels = this.labelService.labels();
    const uuid = this.homeService.activeLabelUuid();
    const activeLabel = labels.find(l => l.uuid === uuid);

    return activeLabel ? activeLabel.color : '#000000';
  });

  currentTimerSeconds = computed(() => {
    const activeSetting = this.settingService.activeSetting();
    const options = this.optionsService.options();

    if (!activeSetting || !options) {
      return 25 * 60;
    }

    const option = options.find(o => o.uuid === activeSetting.timerOptionUuid);
    return option ? option.value * 60 : 25 * 60;
  });

  ngOnInit() {
    this.labelService.loadLabels();
    this.optionsService.loadOptions();
    this.settingService.loadSettings();
    this.entryService.loadEntries();
  }

  onTimerFinish(event: { durationUsed: number }) {
    if (this.isTimerFinished) {
      return;
    }
    this.isTimerFinished = true;

    this.saveHistory(event.durationUsed);
    this.blinkerService.startBlinking('Finished!');
  }

  onTimerReset(event: { durationUsed: number }) {
    this.isTimerFinished = false;
    this.blinkerService.stopBlinking();
    if (event.durationUsed > 0) {
      this.saveHistory(event.durationUsed);
    }
  }

  private saveHistory(durationSeconds: number) {
    const labels = this.labelService.labels();
    const fallbackLabel = labels.length > 0 ? labels[0].uuid : undefined;
    const currentUuid = this.homeService.activeLabelUuid();

    this.entryService.recordTimerFinish(durationSeconds, currentUuid, fallbackLabel);
  }
}
