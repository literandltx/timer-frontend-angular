import {Component, ChangeDetectionStrategy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';

import {HistoryLogComponent} from './components/history-log.component';
import {ToggleGroupComponent} from '../../shared/components/toggle/toggle-group.component';
import {ToggleButtonComponent} from '../../shared/components/toggle/toggle-button.component';
import {PieChartComponent} from './components/widgets/pie-chart-v1/pie-chart.component';
import {
  LineChartHistogramComponentV3
} from './components/widgets/line-chart-v3/line-chart-histogram-v3.component';
import {TimelineWidgetComponent} from './components/widgets/timeline/timeline-widget.component';
import {
  CalendarHeatmapWidgetComponent
} from './components/widgets/calendar-heatmap/calendar-heatmap-widget.component';

@Component({
  selector: 'ns-app-history',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    HistoryLogComponent,
    ToggleGroupComponent,
    ToggleButtonComponent,
    PieChartComponent,
    LineChartHistogramComponentV3,
    TimelineWidgetComponent,
    CalendarHeatmapWidgetComponent,
  ],
  templateUrl: './history.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './history.component.css'
})
export class HistoryComponent {
  activeView: 'activity' | 'logs' = 'activity';
  isEditingWidgets = false;
  widgetOrder = ['pie', 'histogram', 'timeline', 'heatmap'];

  setView(view: 'activity' | 'logs') {
    this.activeView = view;

    if (view !== 'activity') {
      this.isEditingWidgets = false;
    }
  }

  toggleEditWidgets() {
    this.isEditingWidgets = !this.isEditingWidgets;
  }

  dropWidget(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.widgetOrder, event.previousIndex, event.currentIndex);
  }
}
