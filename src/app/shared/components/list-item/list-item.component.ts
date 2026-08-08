import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ns-app-list-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./list-item.component.html`,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./list-item.component.css']
})
export class ListItemComponent {
  @Input() isActive = false;
}
