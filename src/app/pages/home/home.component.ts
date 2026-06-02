import {Component, OnInit, inject, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {TimerComponent} from './components/timer.component';

import {LabelService} from '../../features/services/label.service';
import {TimerSettingService} from '../../features/services/timer-setting.service';
import {TimerEntryService} from '../../features/services/timer-entry.service';
import {TitleBlinkerService} from '../../core/services/title-blinker.service';
import {HomeService} from './home.service';

@Component({
  selector: 'ns-app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TimerComponent],
  providers: [HomeService],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  public labelService = inject(LabelService);
  public settingService = inject(TimerSettingService);
  public entryService = inject(TimerEntryService);
  public homeService = inject(HomeService);
  private blinkerService = inject(TitleBlinkerService);

  activeLabelColor = computed(() => {
    const labels = this.labelService.labels();
    const id = this.homeService.activeLabelId();
    const activeLabel = labels.find(l => l.id === id);

    return activeLabel ? activeLabel.color : '#000000';
  });

  currentTimerSeconds = computed(() => {
    const activeSetting = this.settingService.activeSetting();
    const options = this.settingService.options();

    if (!activeSetting || !options) return 25 * 60;

    const option = options.find(o => o.id == activeSetting.timerOptionId);
    return option ? option.value * 60 : 25 * 60;
  });

  ngOnInit() {
    this.labelService.loadLabels();
    this.settingService.loadData();
    this.entryService.loadEntries();
  }

  onTimerFinish(event: { durationUsed: number }) {
    this.saveHistory(event.durationUsed);
    this.blinkerService.startBlinking('Finished!');
  }

  onTimerReset(event: { durationUsed: number }) {
    this.blinkerService.stopBlinking();
    if (event.durationUsed > 0) {
      this.saveHistory(event.durationUsed);
    }
  }

  private saveHistory(durationSeconds: number) {
    const labels = this.labelService.labels();
    const fallbackLabel = labels.length > 0 ? labels[0].id : undefined;
    const currentId = this.homeService.activeLabelId();

    this.entryService.recordTimerFinish(durationSeconds, currentId, fallbackLabel);
  }
}
