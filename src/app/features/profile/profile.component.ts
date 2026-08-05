import {Component, computed, inject} from '@angular/core';
import {AuthService} from '../../core/auth/auth.service';
import {ButtonComponent} from '../../shared/components/button/button.component';
import {ConfirmDialogService} from '../../shared/components/confirm/confirm-dialog.service';
import {LogService} from '../../core/log/log.service';

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
  private log = inject(LogService);
  private authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);

  public isDeleteDisabled = computed(() => !this.authService.isAuthenticatedSignal());

  onChangeEmail(): void {
    // TODO: Wire up to email change modal or service
    console.log('Change email initiated');
  }

  onChangePassword(): void {
    // TODO: Wire up to password change modal or service
    console.log('Change password initiated');
  }

  async onResetLocalData(): Promise<void> {
    const ok = await this.confirmDialog.confirm(
      'Are you sure you want to reset your local data? This will restore all default values and settings.',
      {confirmLabel: 'Reset', variant: 'danger'}
    );
    if (!ok) return;

    await this.authService.resetLocalData();
    console.log('Local data reset confirmed');
  }

  async onDeleteAccount(): Promise<void> {
    const ok = await this.confirmDialog.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.',
      {confirmLabel: 'Delete', variant: 'danger'}
    );
    if (!ok) return;

    this.authService.deleteAccount().subscribe({
      error: (err) => this.log.error('Failed to delete account', err)
    });
  }
}
