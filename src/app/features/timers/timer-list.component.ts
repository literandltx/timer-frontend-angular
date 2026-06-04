import {Component, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TimerSettingService} from './services/timer-setting.service';
import {TimerOption} from './models/timer-setting.model';
import {ButtonComponent} from '../../shared/components/button/button.component';
import {ListItemComponent} from '../../shared/components/list-item/list-item.component';

@Component({
  selector: 'ns-app-timer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ListItemComponent],
  templateUrl: './timer-list.component.html',
  styleUrl: './timer-list.component.css'
})
export class TimerListComponent implements OnInit {
  public timerService = inject(TimerSettingService);

  editingOption: Partial<TimerOption> | null = null;

  ngOnInit() {
    this.timerService.loadData();
  }

  startAdd() {
    if (this.editingOption && !this.editingOption.id) {
      this.editingOption = null;
    } else {
      this.editingOption = {value: 0};
    }
  }

  startEdit(option: TimerOption) {
    if (this.editingOption?.id === option.id) {
      this.editingOption = null;
    } else {
      this.editingOption = {...option};
    }
  }

  cancel() {
    this.editingOption = null;
  }

  async save() {
    if (!this.editingOption) return;

    if (this.editingOption.id) {
      await this.timerService.updateOption(this.editingOption.id, this.editingOption.value!);
    } else {
      await this.timerService.saveOption(this.editingOption.value!);
    }
    this.editingOption = null;
  }

  async deleteOption(event: Event, id: number) {
    event.stopPropagation();
    event.preventDefault();

    setTimeout(async () => {
      if (confirm('Delete this option?')) {
        await this.timerService.deleteOption(id);
      }
    }, 10);
  }
}
