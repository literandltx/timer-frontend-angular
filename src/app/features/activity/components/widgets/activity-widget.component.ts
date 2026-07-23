import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryService } from '../../history.service';

@Component({
  selector: 'ns-activity-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="widget-container">
      <div class="widget-content">
        <div class="widget-header">
          <h3>Activity Overview</h3>
          <span class="entry-count">Total Entries: {{ historyService.entries().length }}</span>
        </div>

        <div class="chart-placeholder">
          <p>16:9 Chart/Data Canvas goes here</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .widget-container {
      width: 100%;
      aspect-ratio: 16 / 10;
      background-color: var(--card-bg, #ffffff);
      border: 1px solid var(--border-light, #e5e7eb);
      border-radius: 12px;
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
    }

    @media (max-width: 640px) {
      .widget-container {
        aspect-ratio: 16 / 13;
      }
    }

    .widget-content {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }

    .widget-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .widget-header h3 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--text-heading, #111827);
    }

    .entry-count {
      font-size: 0.875rem;
      color: var(--text-muted, #6b7280);
    }

    .chart-placeholder {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--bg-subtle, #f3f4f6);
      border: 2px dashed var(--border-input, #e5e7eb);
      border-radius: 8px;
      color: var(--text-muted, #9ca3af);
      font-weight: 500;
      text-align: center;
      padding: 12px;
    }
  `]
})
export class ActivityWidgetComponent {
  public historyService = inject(HistoryService);
}
