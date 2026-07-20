import {Component, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ChartWidgetBase} from '../chart-widget-base';
import {ButtonComponent} from '../../../../../shared/components/button/button.component';
import {ToggleGroupComponent} from '../../../../../shared/components/toggle/toggle-group.component';
import {ToggleButtonComponent} from '../../../../../shared/components/toggle/toggle-button.component';

const days: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAY_X_TICKS = [
  {label: '00:00', position: 0},
  {label: '04:00', position: 16.666},
  {label: '08:00', position: 33.333},
  {label: '12:00', position: 50},
  {label: '16:00', position: 66.666},
  {label: '20:00', position: 83.333},
  {label: '24:00', position: 100}
];

@Component({
  selector: 'ns-bar-chart-widget',
  standalone: true,
  imports: [CommonModule, ButtonComponent, ToggleGroupComponent, ToggleButtonComponent],
  templateUrl: './bar-chart-widget.component.html',
  styleUrl: './bar-chart-widget.component.css'
})
export class BarChartWidgetComponent extends ChartWidgetBase {

  barChartData = computed(() => {
    const filteredEntries = this.filteredEntries();
    const tf = this.timeframe();
    const range = this.periodRange();

    const buckets: {
      id: number,
      titleLabel: string,
      displayLabel: string,
      totalSeconds: number,
      entries: { color: string, seconds: number }[]
    }[] = [];
    let totalSeconds = 0;
    let averageLabel = 'Daily average';
    let averageValue = 0;
    const daysInMonth = new Date(range.targetDate.getFullYear(), range.targetDate.getMonth() + 1, 0).getDate();

    const colorByLabelId = new Map<string, string>();
    const colorFor = (labelId: string): string => {
      let color = colorByLabelId.get(labelId);
      if (color === undefined) {
        color = this.historyService.getLabelColor(labelId);
        colorByLabelId.set(labelId, color);
      }
      return color;
    };

    if (tf === 'day') {
      averageLabel = 'Hourly average';
      for (let i = 0; i < 24; i++) {
        buckets.push({
          id: i,
          titleLabel: `${i.toString().padStart(2, '0')}:00`,
          displayLabel: '',
          totalSeconds: 0,
          entries: []
        });
      }
      for (const entry of filteredEntries) {
        const hour = new Date(entry.startTime).getHours();
        const color = colorFor(entry.labelId);
        buckets[hour].totalSeconds += entry.durationSeconds;
        buckets[hour].entries.push({color, seconds: entry.durationSeconds});
        totalSeconds += entry.durationSeconds;
      }
      averageValue = Math.round((totalSeconds / 60) / 24);

    } else if (tf === 'week') {
      for (let i = 0; i < days.length; i++) {
        buckets.push({
          id: i,
          titleLabel: days[i],
          displayLabel: days[i],
          totalSeconds: 0,
          entries: []
        });
      }
      for (const entry of filteredEntries) {
        const entryDate = new Date(entry.startTime);
        const dayIdx = (entryDate.getDay() || 7) - 1;
        const color = colorFor(entry.labelId);
        buckets[dayIdx].totalSeconds += entry.durationSeconds;
        buckets[dayIdx].entries.push({color, seconds: entry.durationSeconds});
        totalSeconds += entry.durationSeconds;
      }
      averageValue = Math.round((totalSeconds / 60) / 7);

    } else if (tf === 'month') {
      for (let i = 1; i <= daysInMonth; i++) {
        buckets.push({
          id: i,
          titleLabel: `Day ${i}`,
          displayLabel: (i === 1 || i % 5 === 0) ? i.toString() : '',
          totalSeconds: 0,
          entries: []
        });
      }
      for (const entry of filteredEntries) {
        const date = new Date(entry.startTime).getDate();
        const color = colorFor(entry.labelId);
        buckets[date - 1].totalSeconds += entry.durationSeconds;
        buckets[date - 1].entries.push({color, seconds: entry.durationSeconds});
        totalSeconds += entry.durationSeconds;
      }
      averageValue = Math.round((totalSeconds / 60) / daysInMonth);
    }

    for (const bucket of buckets) {
      const colorMap = new Map<string, number>();
      for (const e of bucket.entries) {
        colorMap.set(e.color, (colorMap.get(e.color) || 0) + e.seconds);
      }
      bucket.entries = Array.from(colorMap.entries()).map(([color, seconds]) => ({color, seconds}));
    }

    const maxBucketSeconds = Math.max(...buckets.map(d => d.totalSeconds), 1);
    const maxMinutes = Math.max(Math.ceil(maxBucketSeconds / 60), 10);

    let stepMinutes = 15;
    if (tf === 'day' && maxMinutes <= 60) {
      if (maxMinutes <= 10) {
        stepMinutes = 2;
      } else if (maxMinutes <= 25) {
        stepMinutes = 5;
      } else if (maxMinutes <= 50) {
        stepMinutes = 10;
      } else {
        stepMinutes = 15;
      }
    } else {
      if (maxMinutes > 600) {
        stepMinutes = Math.ceil(maxMinutes / 5 / 60) * 60;
      } else if (maxMinutes <= 60) {
        stepMinutes = 15;
      } else {
        stepMinutes = Math.ceil(maxMinutes / 5 / 30) * 30;
      }
    }

    const yMaxMinutes = stepMinutes * 5;
    const yLabels = [5, 4, 3, 2, 1, 0].map(i => i * stepMinutes);

    const bucketsView = buckets.map(b => {
      const stacks = b.entries.map(e => ({
        color: e.color,
        heightPct: (e.seconds / 60 / yMaxMinutes) * 100
      }));

      const totalMins = Math.round(b.totalSeconds / 60);
      const titleStr = `${b.titleLabel}: ${totalMins} min`;

      return {id: b.id, displayLabel: b.displayLabel, titleStr, stacks};
    });

    let dateRangeStr = 'This Period';
    let titleStr = 'Current Period';

    const offset = this.periodOffset();

    if (tf === 'week') {
      const weekStart = range.targetDate;
      const endOfWeekDate = new Date(range.end - 1);
      dateRangeStr = `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} – ${monthNames[endOfWeekDate.getMonth()]} ${endOfWeekDate.getDate()}`;
      titleStr = offset === 0 ? 'Current Week' : offset === -1 ? 'Last Week' : `${offset > 0 ? '+' : ''}${offset} Weeks`;
    } else if (tf === 'day') {
      const dayDate = range.targetDate;
      dateRangeStr = `${monthNames[dayDate.getMonth()]} ${dayDate.getDate()}, ${dayDate.getFullYear()}`;
      titleStr = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : `${monthNames[dayDate.getMonth()]} ${dayDate.getDate()}`;
    } else if (tf === 'month') {
      const monthStart = range.targetDate;
      dateRangeStr = `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
      titleStr = offset === 0 ? 'This Month' : offset === -1 ? 'Last Month' : `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
    }

    return {
      title: titleStr,
      buckets: bucketsView,
      dayXTicks: DAY_X_TICKS,
      yLabels,
      averageLabel,
      averageValue,
      dateRange: dateRangeStr,
      hasData: totalSeconds > 0
    };
  });
}
