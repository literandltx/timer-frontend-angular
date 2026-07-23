import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryService } from '../../../history.service';

@Component({
  selector: 'ns-line-chart-histogram-v2',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './line-chart-histogram.component.html',
  styleUrls: ['./line-chart-histogram.component.css']
})
export class LineChartHistogramComponentV2 {
  public historyService = inject(HistoryService);
  private entries = this.historyService.entries;

  offset = signal<number>(0);

  daysData = computed(() => {
    const currentOffset = this.offset();
    const now = new Date();

    const dayOfWeek = now.getDay();
    const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMonday + (currentOffset * 7));
    startOfWeek.setHours(0, 0, 0, 0);

    const days = [];
    let maxDuration = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const start = d.getTime();
      const end = start + 86400000;

      const dayEntries = this.entries()?.filter(e =>
        !e.deleted && e.startTime >= start && e.startTime < end
      ) || [];

      const totalSeconds = dayEntries.reduce((acc, curr) => acc + curr.durationSeconds, 0);

      if (totalSeconds > maxDuration) {
        maxDuration = totalSeconds;
      }

      const segments: { color: string, percentage: number }[] = [];

      if (dayEntries.length > 0) {
        const colorTotals = new Map<string, number>();
        for (const entry of dayEntries) {
          const color = entry.label?.color || '#3b82f6';
          const currentTotal = colorTotals.get(color) || 0;
          colorTotals.set(color, currentTotal + entry.durationSeconds);
        }

        for (const [color, total] of colorTotals.entries()) {
          segments.push({
            color: color,
            percentage: (total / totalSeconds) * 100
          });
        }
      }

      days.push({
        date: d,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        durationSeconds: totalSeconds,
        formattedDuration: this.formatDuration(totalSeconds),
        heightPercentage: 0,
        segments: segments
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
