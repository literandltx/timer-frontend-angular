import {Component, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TimerSettingService} from '../settings/timer-setting.service';
import {TimerOption} from '../settings/timer-setting.model';

@Component({
  selector: 'app-timer-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  async deleteOption(id: number) {
    if (confirm('Delete this option?')) {
      await this.timerService.deleteOption(id);
    }
  }
}
