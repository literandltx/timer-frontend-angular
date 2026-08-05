import {Component, inject, computed, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HistoryService} from '../../../history.service';
import {
  WidgetButtonComponent
} from '../../../../../shared/components/widget-button/widget-button.component';

interface TimelineBlock {
  id: string;
  top: number;
  height: number;
  color: string;
  labelName: string;
}

interface DayColumn {
  key: string;
  label: string;
  date: Date;
  isToday: boolean;
  blocks: TimelineBlock[];
}

// const HOUR_MARKS = [3, 6, 9, 12, 15, 18, 21];
const HOUR_MARKS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
const ALL_HOURS = Array.from({length: 23}, (_, i) => i + 1);
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'ns-timeline-widget',
  standalone: true,
  imports: [CommonModule, WidgetButtonComponent],
  templateUrl: './timeline-widget.component.html',
  styleUrl: './timeline-widget.component.css'
})
export class TimelineWidgetComponent {
  public historyService = inject(HistoryService);

  readonly hourMarks = HOUR_MARKS;
  readonly allHours = ALL_HOURS;

  private referenceDate = signal<Date>(this.startOfWeek(new Date()));

  private touchStartX = 0;
  private touchStartY = 0;
  private readonly swipeThreshold = 40;

  rangeLabel = computed(() => this.buildRangeLabel(this.referenceDate()));

  days = computed<DayColumn[]>(() => {
    const start = this.referenceDate();
    const entries = this.historyService.entries().filter(e => !e.deleted);
    const today = new Date();

    return DAY_LABELS.map((label, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);

      const dayEntries = entries.filter(e => this.isSameDay(new Date(e.startTime), date));

      const blocks: TimelineBlock[] = dayEntries.map(e => {
        const startDate = new Date(e.startTime);
        const startHour = startDate.getHours() + startDate.getMinutes() / 60;
        const durationHours = e.durationSeconds / 3600;

        return {
          id: e.uuid,
          top: (startHour / 24) * 100,
          height: Math.min(Math.max((durationHours / 24) * 100, 0.8), 100 - (startHour / 24) * 100),
          color: this.historyService.getLabelColor(e.labelId),
          labelName: this.historyService.getLabelName(e.labelId)
        };
      });

      return {
        key: date.toISOString(),
        label,
        date,
        isToday: this.isSameDay(date, today),
        blocks
      };
    });
  });

  prev() {
    this.shiftWeek(-1);
  }

  next() {
    this.shiftWeek(1);
  }

  onTouchStart(event: TouchEvent) {
    const t = event.touches[0];
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
  }

  onTouchEnd(event: TouchEvent) {
    const t = event.changedTouches[0];
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;

    if (Math.abs(dx) < this.swipeThreshold || Math.abs(dx) < Math.abs(dy)) {
      return;
    }

    if (dx < 0) {
      this.next();
    } else {
      this.prev();
    }
  }

  private shiftWeek(dir: number) {
    const d = new Date(this.referenceDate());
    d.setDate(d.getDate() + dir * 7);
    this.referenceDate.set(d);
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  private buildRangeLabel(start: Date): string {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const startStr = `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`;
    const endStr = `${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`;
    return `${startStr} - ${endStr}`;
  }
}
