import { Component, inject } from '@angular/core';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ThemeService } from '../../core/services/core/theme.service';

@Component({
  selector: 'ns-app-settings',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent {
  public themeService = inject(ThemeService);
}
