import {Component, inject, HostListener, ElementRef} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {ThemeService} from '../../../core/services/theme.service';
import {ButtonComponent} from '../button/button.component';
import {HealthCheckService} from '../../../core/netwrok/health.service';
import {AuthService} from '../../../core/auth/auth.service';

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
  public authService = inject(AuthService);
  private elementRef = inject(ElementRef);

  public isUserMenuOpen = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isUserMenuOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeUserMenu();
    }
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  reset() {
    this.closeUserMenu();

    const isConfirmed = confirm('Are you sure you want to reset all local data? This will clear your offline database and local settings.');

    if (isConfirmed) {
      this.authService.resetLocalData();
    }
  }

  resetAuth() {
    this.closeUserMenu();
    this.reset();
  }

  logout() {
    this.closeUserMenu();
    this.authService.logout();
  }

  deleteAccount() {
    this.closeUserMenu();

    const isConfirmed = confirm('Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.');

    if (isConfirmed) {
      this.authService.deleteAccount();
    }
  }
}
