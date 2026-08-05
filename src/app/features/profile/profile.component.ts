import {Component, computed, inject, ViewChild, ElementRef} from '@angular/core';
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

  @ViewChild('emailModal') emailModal!: ElementRef<HTMLDialogElement>;
  @ViewChild('passwordModal') passwordModal!: ElementRef<HTMLDialogElement>;

  onChangeEmail(): void {
    this.emailModal.nativeElement.showModal();
  }

  closeEmailModal(): void {
    this.emailModal.nativeElement.close();
  }

  saveEmail(newEmail: string): void {
    if (!newEmail) {
      this.log.error('Email cannot be empty');
      return;
    }

    this.log.info('Ready to send to backend:', newEmail);

    // TODO: Wire up to backend API
    // this.authService.updateEmail(newEmail).subscribe(...)

    this.closeEmailModal();
  }

  onChangePassword(): void {
    this.passwordModal.nativeElement.showModal();
  }

  closePasswordModal(): void {
    this.passwordModal.nativeElement.close();
  }

  savePassword(currentPass: string, newPass: string, confirmPass: string): void {
    if (newPass !== confirmPass) {
      this.log.error('New passwords do not match!');
      return;
    }

    this.log.info('Ready to send to backend:', { currentPass, newPass });

    // TODO: Wire up to backend API
    // this.authService.updatePassword(currentPass, newPass).subscribe(...)

    this.closePasswordModal();
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
