import {Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {LabelListComponent} from '../labels/label-list.component';
import {TimerOptionsService} from '../timers/services/timer-options.service';
import {TimerSettingsService} from '../timers/services/timer-settings.service';
import {CreateTimerOptionRequest} from '../timers/models/timer-option.model';

@Component({
  selector: 'ns-app-preset-config',
  standalone: true,
  imports: [CommonModule, FormsModule, LabelListComponent],
  templateUrl: './preset.component.html',
  styleUrls: ['./preset.component.css']
})
export class PresetComponent {
  public optionsService = inject(TimerOptionsService);
  public settingsService = inject(TimerSettingsService);

  options = this.optionsService.options;
  activeSetting = this.settingsService.activeSetting;

  isAdding = false;
  newValue: number | null = null;

  get activeUuid(): string | undefined {
    return this.activeSetting().timerOptionUuid;
  }

  async setActive(uuid: string) {
    await this.settingsService.setActiveOption(uuid);
  }

  startAdd() {
    this.isAdding = true;
    this.newValue = null;
  }

  cancelAdd() {
    this.isAdding = false;
    this.newValue = null;
  }

  async confirmAdd() {
    if (this.newValue === null || this.newValue === undefined || this.newValue <= 0) {
      return;
    }

    const now = new Date().toISOString();
    const request: CreateTimerOptionRequest = {
      uuid: crypto.randomUUID(),
      value: this.newValue,
      createdAt: now,
      updatedAt: now
    };

    await this.optionsService.save(request);
    this.isAdding = false;
    this.newValue = null;
  }

  async deleteOption(event: Event, uuid: string) {
    event.stopPropagation();
    event.preventDefault();
    await this.optionsService.delete(uuid);
  }
}
