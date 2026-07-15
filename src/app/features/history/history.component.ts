import {Component} from '@angular/core';
import {NgComponentOutlet} from '@angular/common';
import {HistoryLogComponent} from './components/history-log.component';
import {ACTIVITY_WIDGETS} from './components/widgets/activity-widgets.registry';

@Component({
  selector: 'ns-app-history',
  standalone: true,
  imports: [HistoryLogComponent, NgComponentOutlet],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent {
  widgets = ACTIVITY_WIDGETS;
}
