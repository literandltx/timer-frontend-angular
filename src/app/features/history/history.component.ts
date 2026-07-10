import {Component} from '@angular/core';
import {HistoryLogComponent} from './components/history-log.component';
import {HistoryChartComponent} from './components/history-chart.component';

@Component({
  selector: 'ns-app-history',
  standalone: true,
  imports: [HistoryLogComponent, HistoryChartComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent {
}
