import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TimerEntryService } from '../../../features/home/services/timer-entry.service';
import {ThemeService} from '../../../core/services/theme.service';
import {ButtonComponent} from '../button/button.component';
import {HealthCheckService} from '../../../core/netwrok/health.service';

@Component({
  selector: 'ns-app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ButtonComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  public healthService = inject(HealthCheckService);
  public themeService = inject(ThemeService);
}
