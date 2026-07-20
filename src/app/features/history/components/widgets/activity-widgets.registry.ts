import {Type} from '@angular/core';
import {PieChartWidgetComponent} from './pie-chart/pie-chart-widget.component';
import {BarChartWidgetComponent} from './bar-chart/bar-chart-widget.component';
import {HeatmapWidgetComponent} from './heatmap/heatmap-widget.component';

export interface WidgetDefinition {
  id: string;
  component: Type<unknown>;
}

export const ACTIVITY_WIDGETS: WidgetDefinition[] = [
  {id: 'heatmap', component: HeatmapWidgetComponent},
  {id: 'pie-chart', component: PieChartWidgetComponent},
  {id: 'bar-chart', component: BarChartWidgetComponent},
];
