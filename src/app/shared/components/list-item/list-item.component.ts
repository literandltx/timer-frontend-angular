import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-list-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="list-item" [class.is-active]="isActive">
      <div class="item-info">
        <ng-content select="[info]"></ng-content>
      </div>

      <div class="item-actions">
        <ng-content select="[actions]"></ng-content>
      </div>
    </div>
  `,
  styleUrls: ['./list-item.component.css']
})
export class ListItemComponent {
  @Input() isActive = false;
}
