import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ActionType = 'delete' | 'edit' | 'add' | 'close' | 'save';

@Component({
  selector: 'ns-action-button',
  standalone: true,
  template: `
    <button
      type="button"
      [class]="'action-btn ' + customClass"
      (click)="onClick($event)"
      [attr.aria-label]="ariaLabel || action"
      [title]="buttonTitle || action">
      @switch (action) {
        @case ('delete') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"></path>
          </svg>
        }
        @case ('edit') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        }
        @case ('add') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        }
        @case ('close') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        }
        @case ('save') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        }
      }
    </button>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .action-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: inherit;
    }

    .action-btn svg {
      width: 16px;
      height: 16px;
    }

    .action-btn:hover {
      opacity: 0.7;
    }
  `]
})
export class ActionButtonComponent {
  @Input({ required: true }) action!: ActionType;

  @Input() buttonTitle?: string;
  @Input() ariaLabel?: string;
  @Input() customClass = '';

  @Output() actionClick = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.actionClick.emit(event);
  }
}
