import {Component, OnInit, inject, computed, signal, HostListener} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule} from '@angular/router';
import {TimerComponent} from './components/timer.component';

import {LabelService} from '../../core/services/label.service';
import {TimerPresetService} from '../../core/services/timer-preset.service';
import {TimerOptionsService} from '../../core/services/timer-options.service';
import {TimerEntryService} from '../../core/services/timer-entry.service';
import {TitleBlinkerService} from '../../core/services/core/title-blinker.service';

@Component({
  selector: 'ns-app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, TimerComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  protected labelService = inject(LabelService);
  protected presetService = inject(TimerPresetService); // Renamed from settingService
  protected optionsService = inject(TimerOptionsService);
  protected entryService = inject(TimerEntryService);

  private blinkerService = inject(TitleBlinkerService);

  private isTimerFinished = false;
  private activeLabel = computed(() => {
    return this.labelService.labels()
      .find(l => l.uuid === this.presetService.activeLabelUuid());
  });

  activeLabelColor = computed(() => this.activeLabel()?.color ?? '#000000');
  activeLabelName = computed(() => this.activeLabel()?.name ?? 'No label');

  isLabelMenuOpen = signal(false);

  toggleLabelMenu() {
    this.isLabelMenuOpen.update(open => !open);
  }

  async selectLabel(uuid: string) {
    await this.presetService.setActiveLabel(uuid);
    this.isLabelMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isLabelMenuOpen()) {
      return;
    }

    const target = event.target as HTMLElement;
    const clickedInsideSelector = target.closest('.label-selector-container');

    if (!clickedInsideSelector) {
      this.isLabelMenuOpen.set(false);
    }
  }

  currentTimerSeconds = computed(() => {
    const activeSetting = this.presetService.activePreset();
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
    this.presetService.loadSettings();
    this.entryService.loadEntries();
  }

  onTimerFinish(event: { durationUsed: number }) {
    if (this.isTimerFinished) {
      return;
    }
    this.isTimerFinished = true;

    this.saveHistory(event.durationUsed);
    this.blinkerService.startBlinking('Finished!');
    this.playSound();
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
    const currentUuid = this.presetService.activeLabelUuid();

    this.entryService.recordTimerFinish(durationSeconds, currentUuid, fallbackLabel);
  }

  private playSound() {
    const audioPath = './sounds/timer-finish.mp3';
    console.log(`[Timer] Attempting to load and play sound from: ${audioPath}`);

    const audio = new Audio(audioPath);

    audio.play()
      .then(() => {
        console.log('[Timer] Audio playback started successfully.');
      })
      .catch(error => {
        console.error('[Timer] Audio playback failed. Details:', error);
        console.warn(`[Timer] Troubleshooting: Ensure the file exists and is accessible at http://localhost:4200${audioPath}`);
      });
  }
}
