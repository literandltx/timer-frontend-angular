import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TimerEntryService } from '../../../features/home/service/timer-entry.service';
import {ThemeService} from '../../../core/service/theme.service';

@Component({
  selector: 'ns-app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  public entryService = inject(TimerEntryService);
  public themeService = inject(ThemeService);
}
