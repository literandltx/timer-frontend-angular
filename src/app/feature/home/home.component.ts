import {Component, OnInit, inject, effect, computed, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {TimerComponent} from '../timer/timer/timer.component';

import {LabelService} from '../labels/label.service';
import {TimerSettingService} from '../timer/settings/timer-setting.service';
import {TimerEntryService} from '../timer/entry/timer-entry.service';
import {TitleBlinkerService} from './title-blinker.service';

@Component({
  selector: 'ns-app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TimerComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  public labelService = inject(LabelService);
  public settingService = inject(TimerSettingService);
  public entryService = inject(TimerEntryService);
  private blinkerService = inject(TitleBlinkerService);

  activeLabelId = signal<number | undefined>(undefined);

  constructor() {
    const savedLabelId = localStorage.getItem('activeLabelId');

    if (savedLabelId) {
      this.activeLabelId.set(Number(savedLabelId));
    }

    effect(() => {
      const labels = this.labelService.labels();
      const currentId = this.activeLabelId();

      if (labels.length > 0) {
        const labelExists = labels.some(l => l.id === currentId);

        if (currentId === undefined || !labelExists) {
          this.activeLabelId.set(labels[0].id);
        }
      }
    }, {allowSignalWrites: true});

    effect(() => {
      const currentId = this.activeLabelId();
      if (currentId !== undefined) {
        localStorage.setItem('activeLabelId', currentId.toString());
      }
    });
  }

  activeLabelColor = computed(() => {
    const labels = this.labelService.labels();
    if (labels.length === 0) return '#000000';

    const id = this.activeLabelId();
    const activeLabel = labels.find(l => l.id === id);

    return activeLabel ? activeLabel.color : labels[0].color;
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
    const currentId = this.activeLabelId();
    const labelExists = labels.some(l => l.id === currentId);
    const finalLabelId = labelExists ? currentId : fallbackLabel;

    this.entryService.recordTimerFinish(durationSeconds, finalLabelId, fallbackLabel);
  }
}
