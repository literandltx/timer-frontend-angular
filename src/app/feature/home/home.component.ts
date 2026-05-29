import {Component, OnInit, inject, effect, computed, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {TimerComponent} from '../timer/timer/timer.component';

import {LabelService} from '../labels/label.service';
import {TimerSettingService} from '../timer/settings/timer-setting.service';
import {TimerEntryService} from '../timer/entry/timer-entry.service';

const DEFAULT_MINIMUM_TIMER_DURATION = 60;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TimerComponent],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  public labelService = inject(LabelService);
  public settingService = inject(TimerSettingService);
  public entryService = inject(TimerEntryService);

  activeLabelId = signal<number | undefined>(undefined);

  private blinkInterval: any;
  private originalTitle = document.title;

  constructor() {
    effect(() => {
      const labels = this.labelService.labels();
      if (labels.length > 0 && this.activeLabelId() === undefined) {
        this.activeLabelId.set(labels[0].id);
      }
    });
  }

  activeLabelColor = computed(() => {
    const labels = this.labelService.labels();
    if (labels.length === 0) return '#000000';

    const id = this.activeLabelId() ?? labels[0].id;
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
    this.startBlinking();
  }

  onTimerReset(event: { durationUsed: number }) {
    this.stopBlinking();

    if (event.durationUsed <= 0) {
      return;
    }

    const finalDuration = Math.max(event.durationUsed, DEFAULT_MINIMUM_TIMER_DURATION);
    this.saveHistory(finalDuration);
  }

  private saveHistory(durationSeconds: number) {
    const labels = this.labelService.labels();
    const fallbackLabel = labels.length > 0 ? labels[0].id : null;
    const finalLabelId = this.activeLabelId() || fallbackLabel;

    if (!finalLabelId) {
      console.warn("No label selected, cannot save history.");
      return;
    }

    console.log("Save entry");
    this.entryService.save({
      labelId: finalLabelId,
      durationSeconds: durationSeconds,
      startTime: Date.now() - (durationSeconds * 1000)
    });
  }

  private startBlinking() {
    let isOriginal = false;
    this.blinkInterval = setInterval(() => {
      document.title = isOriginal ? this.originalTitle : '⏰ Timer Finished!';
      isOriginal = !isOriginal;
    }, 1000);
  }

  private stopBlinking() {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      document.title = this.originalTitle;
    }
  }
}
