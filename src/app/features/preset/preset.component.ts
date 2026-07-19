import {Component, OnInit, inject, HostListener} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ListItemComponent} from '../../shared/components/list-item/list-item.component';
import {TimerOptionsService} from '../../core/services/timer-options.service';
import {TimerSettingsService} from '../../core/services/timer-settings.service';
import {CreateTimerOptionRequest} from '../../core/models/timer-option.model';
import {LabelService} from '../../core/services/label.service';
import {Label, CreateLabelRequest, UpdateLabelRequest} from '../../core/models/label.model';
import {HomeService} from '../home/services/home.service';

@Component({
  selector: 'ns-app-preset-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ListItemComponent],
  providers: [HomeService],
  templateUrl: './preset.component.html',
  styleUrls: ['./preset.component.css']
})
export class PresetComponent implements OnInit {
  private optionsService = inject(TimerOptionsService);
  private settingsService = inject(TimerSettingsService);
  private labelService = inject(LabelService);
  public homeService = inject(HomeService);

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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (this.isAdding) {
      const clickedInsideTimerEdit = target.closest('.edit-section');
      const clickedTrigger = target.closest('.option-chip-default');
      const clickedChipDelete = target.closest('.chip-delete');

      if (!clickedInsideTimerEdit && !clickedTrigger && !clickedChipDelete) {
        this.cancelAdd();
      }
    }

    if (this.editingLabel) {
      const clickedInsideLabelEdit = target.closest('.edit-section2');
      const clickedAddTrigger = target.closest('.add-icon-btn');
      const clickedEditTrigger = target.closest('.edit-icon-btn');
      const clickedDeleteTrigger = target.closest('.delete-icon-btn');
      const clickedActiveTrigger = target.closest('.active-toggle-btn');

      if (!clickedInsideLabelEdit && !clickedAddTrigger && !clickedEditTrigger && !clickedDeleteTrigger && !clickedActiveTrigger) {
        this.cancelLabel();
      }
    }
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

  startAddLabel(event?: Event) {
    event?.stopPropagation();
    const isAlreadyAdding = this.editingLabel && !this.editingLabel.uuid;
    this.editingLabel = isAlreadyAdding ? null : {name: '', color: '#3b82f6'};
  }

  startEditLabel(label: Label, event?: Event) {
    event?.stopPropagation();
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

  setActiveLabel(uuid: string) {
    this.homeService.setActiveLabel(uuid);
  }
}
