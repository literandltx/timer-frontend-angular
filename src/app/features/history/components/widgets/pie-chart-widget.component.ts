import {Component, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ChartWidgetBase} from './chart-widget-base';
import {ToggleGroupComponent} from '../../../../shared/components/toggle/toggle-group.component';
import {ToggleButtonComponent} from '../../../../shared/components/toggle/toggle-button.component';

interface ChartLegendItem {
  name: string;
  color: string;
  formattedTime: string;
  percentage: number;
  rawSeconds: number;
}

@Component({
  selector: 'ns-pie-chart-widget',
  standalone: true,
  imports: [CommonModule, ToggleGroupComponent, ToggleButtonComponent],
  templateUrl: './pie-chart-widget.component.html',
  styleUrl: './pie-chart-widget.component.css'
})
export class PieChartWidgetComponent extends ChartWidgetBase {

  chartData = computed(() => {
    const filteredEntries = this.filteredEntries();

    const aggregated = new Map<string, number>();
    let totalSeconds = 0;

    for (const entry of filteredEntries) {
      const current = aggregated.get(entry.labelId) || 0;
      aggregated.set(entry.labelId, current + entry.durationSeconds);
      totalSeconds += entry.durationSeconds;
    }

    const sortedData = Array.from(aggregated.entries()).sort((a, b) => b[1] - a[1]);

    let currentPercentage = 0;
    const slices: string[] = [];
    const legend: ChartLegendItem[] = [];

    for (const [labelId, duration] of sortedData) {
      const percentage = totalSeconds > 0 ? (duration / totalSeconds) * 100 : 0;
      const labelName = this.historyService.getLabelName(labelId);
      const color = this.historyService.getLabelColor(labelId);

      slices.push(`${color} ${currentPercentage}% ${currentPercentage + percentage}%`);

      legend.push({
        name: labelName,
        color,
        formattedTime: this.formatTime(duration),
        percentage: Math.round(percentage),
        rawSeconds: duration
      });

      currentPercentage += percentage;
    }

    return {
      hasData: totalSeconds > 0,
      formattedTotal: this.formatTime(totalSeconds),
      conicStyle: slices.length > 0 ? `conic-gradient(${slices.join(', ')})` : 'none',
      legend
    };
  });
}
