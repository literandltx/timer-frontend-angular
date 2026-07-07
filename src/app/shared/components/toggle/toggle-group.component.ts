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
    :host { display: block; }
    .toggle-group {
      display: flex;
      align-items: center;
      border-radius: 12px;
    }
    .group-standard {
      background: var(--bg-color);
      border: 1px solid var(--border-light);
      padding: 4px;
      gap: 4px;
    }
    .group-subtle {
      background: var(--bg-subtle);
      padding: 8px;
      gap: 8px;
    }
    .group-transparent {
      background: transparent;
      padding: 0;
      gap: 8px;
    }
  `]
})
export class ToggleGroupComponent {
  @Input() variant: 'standard' | 'subtle' | 'transparent' = 'standard';
}
