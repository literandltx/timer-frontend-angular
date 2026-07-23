import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryService } from '../../../history.service';

@Component({
  selector: 'ns-line-chart-histogram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './line-chart-histogram.component.html',
  styleUrls: ['./line-chart-histogram.component.css']
})
export class LineChartHistogramComponent {
  public historyService = inject(HistoryService);
  private entries = this.historyService.entries;

  offset = signal<number>(0);
  daysData = computed(() => {
    const currentOffset = this.offset();
    const today = new Date();
    today.setDate(today.getDate() + (currentOffset * 7));
    today.setHours(0, 0, 0, 0);

    const days = [];
    let maxDuration = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000;

      const dayEntries = this.entries()?.filter(e =>
        !e.deleted && e.startTime >= start && e.startTime < end
      ) || [];

      const totalSeconds = dayEntries.reduce((acc, curr) => acc + curr.durationSeconds, 0);

      if (totalSeconds > maxDuration) {
        maxDuration = totalSeconds;
      }

      days.push({
        date: d,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        durationSeconds: totalSeconds,
        formattedDuration: this.formatDuration(totalSeconds),
        heightPercentage: 0
      });
    }

    return days.map(day => ({
      ...day,
      heightPercentage: maxDuration > 0 ? (day.durationSeconds / maxDuration) * 100 : 0
    }));
  });

  formatDuration(totalSeconds: number): string {
    if (totalSeconds === 0) return '0m';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);

    if (h > 0 && m === 0) return `${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  navigate(direction: number) {
    this.offset.update(v => v + direction);
  }
}
