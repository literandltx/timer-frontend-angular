import {Component, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {LabelService} from './services/label.service';
import {Label} from './models/label.model';
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
    if (this.editingLabel && !this.editingLabel.id) {
      this.editingLabel = null;
    } else {
      this.editingLabel = {name: '', color: '#3b82f6'};
    }
  }

  startEdit(label: Label) {
    if (this.editingLabel?.id === label.id) {
      this.editingLabel = null;
    } else {
      this.editingLabel = {...label};
    }
  }

  cancel() {
    this.editingLabel = null;
  }

  async save() {
    if (!this.editingLabel) return;
    const request = {name: this.editingLabel.name!, color: this.editingLabel.color!};

    if (this.editingLabel.id) {
      await this.labelService.update(this.editingLabel.id, request);
    } else {
      await this.labelService.save(request);
    }
    this.editingLabel = null;
  }

  async deleteLabel(event: Event, id: number) {
    event.preventDefault();
    event.stopPropagation();

    if (confirm('Delete this label?')) {
      await this.labelService.delete(id);
    }
  }
}
