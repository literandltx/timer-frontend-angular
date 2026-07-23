import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryLogComponent } from './components/history-log.component';
import { ToggleGroupComponent } from '../../shared/components/toggle/toggle-group.component';
import { ToggleButtonComponent } from '../../shared/components/toggle/toggle-button.component';
import { HistoryService } from './history.service';
import {ActivityWidgetComponent} from './components/widgets/activity-widget.component';
import {PieChartComponent} from './components/widgets/pie-chart-v1/pie-chart.component';
import {
  LineChartHistogramComponent
} from './components/widgets/line-chart-v1/line-chart-histogram.component';

@Component({
  selector: 'ns-app-history',
  standalone: true,
  imports: [
    CommonModule,
    HistoryLogComponent,
    ToggleGroupComponent,
    ToggleButtonComponent,
    ActivityWidgetComponent,
    PieChartComponent,
    LineChartHistogramComponent
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent {
  public historyService = inject(HistoryService);

  activeView: 'activity' | 'logs' = 'activity';

  setView(view: 'activity' | 'logs') {
    this.activeView = view;
  }
}
