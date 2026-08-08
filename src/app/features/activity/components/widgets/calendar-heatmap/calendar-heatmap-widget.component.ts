import {Component, inject, Input, signal, computed, ChangeDetectionStrategy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HistoryService} from '../../../history.service';
import {
  WidgetButtonComponent
} from '../../../../../shared/components/widget-button/widget-button.component';

interface DayCell {
  day: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  key: string;
}

@Component({
  selector: 'ns-calendar-heatmap',
  standalone: true,
  imports: [CommonModule, WidgetButtonComponent],
  templateUrl: './calendar-heatmap-widget.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './calendar-heatmap-widget.component.css'
})
export class CalendarHeatmapWidgetComponent {
  public historyService = inject(HistoryService);

  @Input() unitLabel = 'records'; // logs, records, activities
  @Input() levelThresholds: [number, number, number, number] = [1, 2, 3, 4];

  readonly weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  private referenceDate = signal<Date>(new Date());

  monthLabel = computed(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const d = this.referenceDate();
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  });

  private dailyCounts = computed<number[]>(() => {
    const ref = this.referenceDate();
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const counts = new Array(daysInMonth).fill(0);

    this.historyService.entries()
      .filter(e => !e.deleted)
      .forEach(e => {
        const d = new Date(e.startTime);
        if (d.getFullYear() === year && d.getMonth() === month) {
          counts[d.getDate() - 1] += 1;
        }
      });

    return counts;
  });

  totalCount = computed(() =>
    this.dailyCounts().reduce((sum, c) => sum + c, 0)
  );

  cells = computed<(DayCell | null)[]>(() => {
    const ref = this.referenceDate();
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const counts = this.dailyCounts();

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    const cells: (DayCell | null)[] = new Array(firstWeekday).fill(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const count = counts[day - 1];
      cells.push({
        day,
        count,
        level: this.toLevel(count),
        isToday: isCurrentMonth && today.getDate() === day,
        key: `${year}-${month}-${day}`
      });
    }

    return cells;
  });

  prev() {
    this.shift(-1);
  }

  next() {
    this.shift(1);
  }

  private shift(dir: number) {
    const d = new Date(this.referenceDate());
    d.setMonth(d.getMonth() + dir);
    this.referenceDate.set(d);
  }

  private toLevel(count: number): 0 | 1 | 2 | 3 | 4 {
    const [t1, t2, t3, t4] = this.levelThresholds;
    if (count < t1) return 0;
    if (count < t2) return 1;
    if (count < t3) return 2;
    if (count < t4) return 3;
    return 4;
  }
}
