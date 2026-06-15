// label-list.component.ts
import {Component, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {LabelService} from './services/label.service';
import {Label, CreateLabelRequest, UpdateLabelRequest} from './models/label.model';
import {ButtonComponent} from '../../shared/components/button/button.component';
import {ListItemComponent} from '../../shared/components/list-item/list-item.component';

@Component({
  selector: 'ns-app-label-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ListItemComponent],
  templateUrl: './label-list.component.html',
  styleUrls: ['./label-list.component.css']
})
export class LabelListComponent implements OnInit {
  public labelService = inject(LabelService);

  editingLabel: Partial<Label> | null = null;

  ngOnInit() {
    this.labelService.loadLabels();
  }

  startAdd() {
    if (this.editingLabel && !this.editingLabel.uuid) {
      this.editingLabel = null;
    } else {
      this.editingLabel = {name: '', color: '#3b82f6'};
    }
  }

  startEdit(label: Label) {
    if (this.editingLabel?.uuid === label.uuid) {
      this.editingLabel = null;
    } else {
      this.editingLabel = {...label};
    }
  }

  cancel() {
    this.editingLabel = null;
  }

  async save() {
    if (!this.editingLabel || !this.editingLabel.name || !this.editingLabel.color) {
      return;
    }

    const now = new Date().toISOString();

    if (this.editingLabel.uuid) {
      const request: UpdateLabelRequest = {
        name: this.editingLabel.name,
        color: this.editingLabel.color,
        updatedAt: now
      };
      await this.labelService.update(this.editingLabel.uuid, request);
    } else {
      const request: CreateLabelRequest = {
        uuid: crypto.randomUUID(),
        name: this.editingLabel.name,
        color: this.editingLabel.color,
        createdAt: now,
        updatedAt: now
      };
      await this.labelService.save(request);
    }
    this.editingLabel = null;
  }

  async deleteLabel(event: Event, uuid: string) {
    event.preventDefault();
    event.stopPropagation();

    await this.labelService.delete(uuid);
  }
}
