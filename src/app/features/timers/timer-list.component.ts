import {Component, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TimerOptionsService} from './services/timer-options.service';
import {TimerSettingsService} from './services/timer-settings.service';
import {ButtonComponent} from '../../shared/components/button/button.component';
import {ListItemComponent} from '../../shared/components/list-item/list-item.component';
import {
  TimerOption,
  CreateTimerOptionRequest,
  UpdateTimerOptionRequest
} from './models/timer-option.model'

@Component({
  selector: 'ns-app-timer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ListItemComponent],
  templateUrl: './timer-list.component.html',
  styleUrl: './timer-list.component.css'
})
export class TimerListComponent implements OnInit {
  public optionsService = inject(TimerOptionsService);
  public settingsService = inject(TimerSettingsService);

  editingOption: Partial<TimerOption> | null = null;
  options = this.optionsService.options;
  timerOption = this.settingsService.activeSetting;

  ngOnInit() {
  }

  startAdd() {
    const isAlreadyAdding = this.editingOption && !this.editingOption.uuid;
    this.editingOption = isAlreadyAdding ? null : {value: 0};
  }

  startEdit(option: TimerOption) {
    const isAlreadyEditingThis = this.editingOption?.uuid === option.uuid;
    this.editingOption = isAlreadyEditingThis ? null : {...option};
  }

  cancel() {
    this.editingOption = null;
  }

  async save() {
    if (this.editingOption?.value === undefined || this.editingOption?.value === null) {
      return;
    }

    const now = new Date().toISOString();

    if (this.editingOption.uuid) {
      const request: UpdateTimerOptionRequest = {
        value: this.editingOption.value,
        updatedAt: now
      };
      await this.optionsService.update(this.editingOption.uuid, request);
    } else {
      const request: CreateTimerOptionRequest = {
        uuid: crypto.randomUUID(),
        value: this.editingOption.value,
        createdAt: now,
        updatedAt: now
      };
      await this.optionsService.save(request);
    }
    this.editingOption = null;
  }

  async deleteOption(event: Event, uuid: string) {
    event.preventDefault();
    event.stopPropagation();
    await this.optionsService.delete(uuid);
  }

  async setActive(uuid: string) {
    await this.settingsService.setActiveOption(uuid);
  }
}
