import {Component, computed, inject, ViewChild, ElementRef, signal} from '@angular/core';
import {AuthService} from '../../core/auth/auth.service';
import {ButtonComponent} from '../../shared/components/button/button.component';
import {ConfirmDialogService} from '../../shared/components/confirm/confirm-dialog.service';
import {LogService} from '../../core/log/log.service';
import {isValidEmail} from '../../shared/utils/email-validator.util';

@Component({
  selector: 'ns-app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  imports: [ButtonComponent],
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  private log = inject(LogService);
  private authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);

  public isDeleteDisabled = computed(() => !this.authService.isAuthenticatedSignal());

  public emailError = signal<string | null>(null);
  public passwordError = signal<string | null>(null);

  @ViewChild('emailModal') emailModal!: ElementRef<HTMLDialogElement>;
  @ViewChild('passwordModal') passwordModal!: ElementRef<HTMLDialogElement>;

  onChangeEmail(): void {
    this.emailError.set(null);
    this.emailModal.nativeElement.showModal();
  }

  closeEmailModal(): void {
    this.emailError.set(null);
    this.emailModal.nativeElement.close();
  }

  saveEmail(newEmail: string, password: string): void {
    this.emailError.set(null);

    if (!newEmail) {
      this.emailError.set('Email address is required.');
      return;
    }
    if (!isValidEmail(newEmail)) {
      this.emailError.set('Please enter a valid email address.');
      return;
    }
    if (!password) {
      this.emailError.set('Current password is required.');
      return;
    }

    this.authService.changeEmail(newEmail, password).subscribe({
      next: () => this.closeEmailModal(),
      error: (err) => {
        this.log.error('Failed to change user\'s email ', err);
        this.emailError.set('Failed to update email. Please try again.');
      }
    });
  }

  onChangePassword(): void {
    this.passwordError.set(null);
    this.passwordModal.nativeElement.showModal();
  }

  closePasswordModal(): void {
    this.passwordError.set(null);
    this.passwordModal.nativeElement.close();
  }

  savePassword(currentPass: string, newPass: string, confirmPass: string): void {
    this.passwordError.set(null);

    if (!currentPass || !newPass || !confirmPass) {
      this.passwordError.set('All password fields are required.');
      return;
    }
    if (newPass !== confirmPass) {
      this.passwordError.set('New passwords do not match!');
      return;
    }

    this.authService.changePassword(currentPass, newPass, confirmPass).subscribe({
      next: () => this.closePasswordModal(),
      error: (err) => {
        this.log.error('Failed to change user\'s password ', err);
        this.passwordError.set('Failed to update password. Please try again.');
      }
    });
  }

  async onResetLocalData(): Promise<void> {
    const ok = await this.confirmDialog.confirm(
      'Are you sure you want to reset your local data? This will restore all default values and settings.',
      {confirmLabel: 'Reset', variant: 'danger'}
    );
    if (!ok) return;

    await this.authService.resetLocalData();
    this.log.info('Local data reset confirmed');
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
