import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LabelService } from './services/label.service';
import { Label, CreateLabelRequest, UpdateLabelRequest } from './models/label.model';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ListItemComponent } from '../../shared/components/list-item/list-item.component';

@Component({
  selector: 'ns-app-label-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ListItemComponent],
  templateUrl: './label-list.component.html',
  styleUrls: ['./label-list.component.css']
})
export class LabelListComponent implements OnInit {
  private labelService = inject(LabelService);
  public labels = this.labelService.labels;

  public editingLabel: Partial<Label> | null = null;

  ngOnInit() {
    this.labelService.loadLabels();
  }

  startAdd() {
    const isAlreadyAdding = this.editingLabel && !this.editingLabel.uuid;
    this.editingLabel = isAlreadyAdding ? null : { name: '', color: '#3b82f6' };
  }

  startEdit(label: Label) {
    const isAlreadyEditingThis = this.editingLabel?.uuid === label.uuid;
    this.editingLabel = isAlreadyEditingThis ? null : { ...label };
  }

  cancel() {
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
