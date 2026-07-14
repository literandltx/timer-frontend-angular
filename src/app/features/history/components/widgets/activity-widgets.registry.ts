import {Type} from '@angular/core';
import {PieChartWidgetComponent} from './pie-chart-widget.component';
import {BarChartWidgetComponent} from './bar-chart-widget.component';

export interface WidgetDefinition {
  id: string;
  component: Type<unknown>;
}

/**
 * All widgets shown in the Activity tab, top to bottom.
 *
 * To add a new widget:
 *   1. Create a standalone component under components/widgets/
 *      (extend ChartWidgetBase if it needs a timeframe + date range).
 *   2. Add one entry here with a unique id.
 * No other file needs to change - history.component.html renders
 * whatever is in this array.
 */
export const ACTIVITY_WIDGETS: WidgetDefinition[] = [
  {id: 'pie-chart', component: PieChartWidgetComponent},
  {id: 'bar-chart', component: BarChartWidgetComponent},
];
