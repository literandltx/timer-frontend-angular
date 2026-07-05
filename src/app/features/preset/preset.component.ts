import {Component, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ButtonComponent} from '../../shared/components/button/button.component';
import {ListItemComponent} from '../../shared/components/list-item/list-item.component';
import {TimerOptionsService} from '../timers/services/timer-options.service';
import {TimerSettingsService} from '../timers/services/timer-settings.service';
import {CreateTimerOptionRequest} from '../timers/models/timer-option.model';
import {LabelService} from '../labels/services/label.service';
import {Label, CreateLabelRequest, UpdateLabelRequest} from '../labels/models/label.model';

@Component({
  selector: 'ns-app-preset-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ListItemComponent],
  templateUrl: './preset.component.html',
  styleUrls: ['./preset.component.css']
})
export class PresetComponent implements OnInit {
  private optionsService = inject(TimerOptionsService);
  private settingsService = inject(TimerSettingsService);
  private labelService = inject(LabelService);

  labels = this.labelService.labels;
  options = this.optionsService.options;
  activeSetting = this.settingsService.activeSetting;

  isAdding = false;
  newValue: number | null = null;
  editingLabel: Partial<Label> | null = null;

  ngOnInit() {
    this.labelService.loadLabels();
  }

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

  startAddLabel() {
    const isAlreadyAdding = this.editingLabel && !this.editingLabel.uuid;
    this.editingLabel = isAlreadyAdding ? null : {name: '', color: '#3b82f6'};
  }

  startEditLabel(label: Label) {
    const isAlreadyEditingThis = this.editingLabel?.uuid === label.uuid;
    this.editingLabel = isAlreadyEditingThis ? null : {...label};
  }

  cancelLabel() {
    this.editingLabel = null;
  }

  async createLabel() {
    if (!this.editingLabel?.name || !this.editingLabel?.color) {
      return;
    }

    const now = new Date().toISOString();
    const request: CreateLabelRequest = {
      uuid: crypto.randomUUID(),
      name: this.editingLabel.name,
      color: this.editingLabel.color,
      createdAt: now,
      updatedAt: now
    };

    await this.labelService.save(request);
    this.editingLabel = null;
  }

  async updateLabel() {
    if (!this.editingLabel?.uuid || !this.editingLabel?.name || !this.editingLabel?.color) {
      return;
    }

    const request: UpdateLabelRequest = {
      name: this.editingLabel.name,
      color: this.editingLabel.color,
      updatedAt: new Date().toISOString()
    };

    await this.labelService.update(this.editingLabel.uuid, request);
    this.editingLabel = null;
  }

  async deleteLabel(event: Event, uuid: string) {
    event.preventDefault();
    event.stopPropagation();
    await this.labelService.delete(uuid);
  }
}
