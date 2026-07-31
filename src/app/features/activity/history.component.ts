import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryLogComponent } from './components/history-log.component';
import { ToggleGroupComponent } from '../../shared/components/toggle/toggle-group.component';
import { ToggleButtonComponent } from '../../shared/components/toggle/toggle-button.component';
import {PieChartComponent} from './components/widgets/pie-chart-v1/pie-chart.component';
import {
  LineChartHistogramComponentV3
} from './components/widgets/line-chart-v3/line-chart-histogram-v3.component';
import {TimelineWidgetComponent} from './components/widgets/timeline/timeline-widget.component';

@Component({
  selector: 'ns-app-history',
  standalone: true,
  imports: [
    CommonModule,
    HistoryLogComponent,
    ToggleGroupComponent,
    ToggleButtonComponent,
    PieChartComponent,
    LineChartHistogramComponentV3,
    TimelineWidgetComponent,
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent {
  activeView: 'activity' | 'logs' = 'activity';

  setView(view: 'activity' | 'logs') {
    this.activeView = view;
  }
}
