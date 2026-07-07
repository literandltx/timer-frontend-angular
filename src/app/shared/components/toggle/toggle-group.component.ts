import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ns-app-toggle-group',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toggle-group" [ngClass]="'group-' + variant">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .toggle-group {
      display: flex;
      align-items: center;
      border-radius: 12px;
    }

  `]
})
export class ToggleGroupComponent {
  @Input() variant: 'standard' | 'subtle' | 'transparent' = 'standard';
}
