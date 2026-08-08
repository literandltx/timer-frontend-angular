import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

export type WidgetIconType = 'prev' | 'next' | 'labels';

@Component({
  selector: 'ns-widget-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="icon-btn"
      [disabled]="disabled"
      (click)="onClick($event)"
      [attr.aria-label]="ariaLabel || icon"
      [title]="buttonTitle || icon"
      [attr.aria-haspopup]="ariaHasPopup"
      [attr.aria-expanded]="ariaExpanded">
      @switch (icon) {
        @case ('prev') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"></path>
          </svg>
        }
        @case ('next') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
        }
        @case ('labels') {
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/>
          </svg>
        }
      }
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    :host {
      display: contents;
    }

    .icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      border: 1px solid var(--border-light, #333333);
      background: var(--bg-subtle, #2c2c2e);
      color: var(--text-muted, #9ca3af);
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
      transition: background-color 0.2s, color 0.2s;
    }

    .icon-btn:hover:not(:disabled) {
      background: var(--bg-hover, #3a3a3c);
      color: var(--text-heading, #ffffff);
    }

    .icon-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .icon-btn svg {
      width: 16px;
      height: 16px;
    }

    @media (max-width: 768px) {
      .icon-btn {
        width: 28px;
        height: 28px;
      }

      .icon-btn svg {
        width: 14px;
        height: 14px;
      }
    }
  `]
})
export class WidgetButtonComponent {
  @Input({ required: true }) icon!: WidgetIconType;

  @Input() buttonTitle?: string;
  @Input() ariaLabel?: string;
  @Input() disabled = false;
  @Input() ariaHasPopup?: string | null = null;
  @Input() ariaExpanded?: string | boolean | null = null;

  @Output() buttonClick = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.buttonClick.emit(event);
  }
}
