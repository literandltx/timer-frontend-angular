import {Component, OnInit, inject, HostListener, ChangeDetectionStrategy, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {ListItemComponent} from '../../shared/components/list-item/list-item.component';
import {TimerOptionsService} from '../../core/services/timer-options.service';
import {TimerPresetService} from '../../core/services/timer-preset.service';
import {CreateTimerOptionRequest} from '../../core/models/timer-option.model';
import {LabelService} from '../../core/services/label.service';
import {Label, CreateLabelRequest, UpdateLabelRequest} from '../../core/models/label.model';
import {ActionButtonComponent} from '../../shared/components/action-button/action-button.component';
import {StorageService} from '../../core/storage/storage.service';

@Component({
  selector: 'ns-app-preset-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ListItemComponent, ActionButtonComponent, DragDropModule],
  templateUrl: './preset.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./preset.component.css']
})
export class PresetComponent implements OnInit {
  private optionsService = inject(TimerOptionsService);
  private labelService = inject(LabelService);
  private presetService = inject(TimerPresetService);
  private storageService = inject(StorageService);

  labels = this.labelService.labels;
  options = this.optionsService.options;
  activePreset = this.presetService.activePreset;

  orderedLabels = computed(() => {
    const labels = this.labels();
    const order = this.storageService.get<string[]>('app_label_order');
    if (!order || order.length === 0) return labels;

    return [...labels].sort((a, b) => {
      const idxA = order.indexOf(a.uuid);
      const idxB = order.indexOf(b.uuid);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  });

  isAdding = false;
  isEditingTimers = false;
  newValue: number | null = null;
  editingLabel: Partial<Label> | null = null;

  ngOnInit() {
    this.labelService.loadLabels();
  }

  get activeTimerOptionUuid(): string | undefined {
    return this.activePreset().timerOptionUuid;
  }

  get activeLabelUuid(): string | undefined {
    return this.presetService.activeLabelUuid();
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

  dropLabel(event: CdkDragDrop<Label[]>) {
    const currentLabels = [...this.orderedLabels()];
    moveItemInArray(currentLabels, event.previousIndex, event.currentIndex);
    this.labelService.labels.set(currentLabels);
    this.storageService.set('app_label_order', currentLabels.map(l => l.uuid));
  }

  async setActiveTimerOption(uuid: string) {
    await this.presetService.setActiveTimerOption(uuid);
  }

  toggleEditTimers() {
    this.isEditingTimers = !this.isEditingTimers;
    if (!this.isEditingTimers) {
      this.cancelAdd();
    }
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

  async setActiveLabel(uuid: string) {
    await this.presetService.setActiveLabel(uuid);
  }
}
