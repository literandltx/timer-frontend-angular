import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toggle-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [class]="'toggle-btn toggle-' + variant"
      [class.is-active]="active"
      (click)="toggled.emit()">
      <ng-content></ng-content>
    </button>
  `,
  styleUrls: ['./toggle-button.component.css']
})
export class ToggleButtonComponent {
  @Input() active: boolean = false;
  @Input() variant: 'standard' | 'icon' | 'solid' = 'standard';
  @Output() toggled = new EventEmitter<void>();
}
