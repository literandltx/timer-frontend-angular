import {Component, computed, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HistoryService} from '../../../services/history.service';

const WEEKS_TO_SHOW = 16;
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface HeatmapDay {
  date: Date;
  totalSeconds: number;
  intensity: number;
}

@Component({
  selector: 'ns-heatmap-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './heatmap-widget.component.html',
  styleUrl: './heatmap-widget.component.css'
})
export class HeatmapWidgetComponent {
  private historyService = inject(HistoryService);

  dayRows = [0, 1, 2, 3, 4, 5, 6];

  heatmapData = computed(() => {
    const entries = this.historyService.entries();

    const totalsByDay = new Map<number, number>();
    for (const entry of entries) {
      const d = new Date(entry.startTime);
      d.setHours(0, 0, 0, 0);
      const key = d.getTime();
      totalsByDay.set(key, (totalsByDay.get(key) || 0) + entry.durationSeconds);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDow = today.getDay() || 7;
    const gridEnd = new Date(today);
    gridEnd.setDate(gridEnd.getDate() + (7 - currentDow));

    const gridStart = new Date(gridEnd);
    gridStart.setDate(gridStart.getDate() - (WEEKS_TO_SHOW * 7 - 1));

    let maxSeconds = 0;
    totalsByDay.forEach(v => {
      if (v > maxSeconds) maxSeconds = v;
    });

    const weeks: HeatmapDay[][] = [];
    for (let w = 0; w < WEEKS_TO_SHOW; w++) {
      const column: HeatmapDay[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(gridStart);
        date.setDate(date.getDate() + w * 7 + d);
        const totalSeconds = totalsByDay.get(date.getTime()) || 0;
        column.push({
          date,
          totalSeconds,
          intensity: this.intensityFor(totalSeconds, maxSeconds)
        });
      }
      weeks.push(column);
    }

    const monthLabels = weeks.map((col, i) => {
      const first = col[0].date;
      const prevFirst = i > 0 ? weeks[i - 1][0].date : null;
      const isNewMonth = !prevFirst || first.getMonth() !== prevFirst.getMonth();
      return isNewMonth ? monthNames[first.getMonth()] : '';
    });

    return {weeks, monthLabels, hasData: maxSeconds > 0};
  });

  dayLabel(rowIndex: number): string {
    if (rowIndex === 0) return 'Mon';
    if (rowIndex === 2) return 'Wed';
    if (rowIndex === 4) return 'Fri';
    return '';
  }

  tooltipFor(day: HeatmapDay): string {
    const dateStr = day.date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
    const mins = Math.round(day.totalSeconds / 60);
    return mins > 0 ? `${dateStr}: ${mins} min` : `${dateStr}: no activity`;
  }

  private intensityFor(seconds: number, max: number): number {
    if (seconds <= 0 || max <= 0) return 0;
    const ratio = seconds / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  }
}
