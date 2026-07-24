import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import {ButtonComponent} from '../../shared/components/button/button.component';

@Component({
  selector: 'ns-app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  imports: [
    ButtonComponent
  ],
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  private authService = inject(AuthService);

  onChangeEmail(): void {
    // TODO: Wire up to email change modal or service
    console.log('Change email initiated');
  }

  onChangePassword(): void {
    // TODO: Wire up to password change modal or service
    console.log('Change password initiated');
  }

  onDeleteAccount(): void {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      this.authService.deleteAccount().subscribe();
    }
  }
}
