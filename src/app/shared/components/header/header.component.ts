import {Component, inject, HostListener, ElementRef, signal} from '@angular/core';
import {RouterLink, RouterLinkActive, Router} from '@angular/router';
import {DOCUMENT} from '@angular/common';
import {ThemeService} from '../../../core/services/core/theme.service';
import {ButtonComponent} from '../button/button.component';
import {HealthCheckService} from '../../../core/netwrok/health.service';
import {AuthService} from '../../../core/auth/auth.service';
import {ConfirmDialogService} from '../confirm/confirm-dialog.service';

@Component({
  selector: 'ns-app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  public healthService = inject(HealthCheckService);
  public themeService = inject(ThemeService);
  public authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);
  private elementRef = inject(ElementRef);
  private document = inject(DOCUMENT);
  private router = inject(Router);

  public isFullscreen = signal(false);
  public isFullscreenSupported = signal<boolean>(
    typeof this.document !== 'undefined' && this.document.fullscreenEnabled
  );

  public isUserMenuOpen = false;
  public errorMessage: string | null = null;

  private readonly navRoutes = ['/preset', '/home', '/history'];
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private readonly swipeThreshold = 50;
  private ignoreSwipe = false;

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const activeElement = this.document.activeElement?.tagName.toLowerCase();
    if (activeElement === 'input' || activeElement === 'textarea') return;

    if (event.key === 'ArrowLeft') {
      this.navigatePrev();
    } else if (event.key === 'ArrowRight') {
      this.navigateNext();
    }
  }

  @HostListener('window:touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    if (this.shouldIgnoreSwipe(event.target as HTMLElement)) {
      this.ignoreSwipe = true;
      return;
    }
    this.ignoreSwipe = false;
    this.touchStartX = event.changedTouches[0].screenX;
    this.touchStartY = event.changedTouches[0].screenY;
  }

  @HostListener('window:touchend', ['$event'])
  onTouchEnd(event: TouchEvent) {
    if (this.ignoreSwipe) return;
    this.touchEndX = event.changedTouches[0].screenX;
    this.touchEndY = event.changedTouches[0].screenY;
    this.handleSwipe();
  }

  @HostListener('window:touchcancel')
  onTouchCancel() {
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    this.ignoreSwipe = false;
  }

  private shouldIgnoreSwipe(element: HTMLElement | null): boolean {
    while (element && element !== this.document.body && element !== this.document.documentElement) {
      if (element.classList.contains('no-swipe')) return true;

      const style = window.getComputedStyle(element);
      if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && element.scrollWidth > element.clientWidth) {
        return true;
      }

      const tagName = element.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return true;
      }

      element = element.parentElement;
    }
    return false;
  }

  private handleSwipe() {
    const distanceX = this.touchStartX - this.touchEndX;
    const distanceY = this.touchStartY - this.touchEndY;

    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (distanceX > this.swipeThreshold) {
        this.navigateNext();
      } else if (distanceX < -this.swipeThreshold) {
        this.navigatePrev();
      }
    }
  }

  private navigateNext() {
    const currentIndex = this.navRoutes.indexOf(this.router.url);
    if (currentIndex !== -1 && currentIndex < this.navRoutes.length - 1) {
      this.document.documentElement.className = 'slide-left';
      this.router.navigate([this.navRoutes[currentIndex + 1]]);
    }
  }

  private navigatePrev() {
    const currentIndex = this.navRoutes.indexOf(this.router.url);
    if (currentIndex !== -1 && currentIndex > 0) {
      this.document.documentElement.className = 'slide-right';
      this.router.navigate([this.navRoutes[currentIndex - 1]]);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isUserMenuOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.closeUserMenu();
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(!!this.document.fullscreenElement);
  }

  toggleFullscreen(): void {
    const elem = this.document.documentElement;

    if (!this.document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (this.document.exitFullscreen) {
        this.document.exitFullscreen();
      }
    }
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  async reset(): Promise<void> {
    this.closeUserMenu();
    const ok = await this.confirmDialog.confirm(
      'Are you sure you want to reset all local data? This action will clear all your local database and presets.'
    );
    if (ok) {
      this.authService.resetLocalData();
    }
  }

  async resetAuth(): Promise<void> {
    this.closeUserMenu();
    const ok = await this.confirmDialog.confirm('Are you sure you want to reset all local data? This action will clear all your local database and presets.');
    if (ok) {
      this.authService.clearAuthState();
    }
  }

  logout(): void {
    this.closeUserMenu();
    this.authService.logout().subscribe({
      error: (err) => console.error('Logout error:', err)
    });
  }

  async deleteAccount(): Promise<void> {
    this.closeUserMenu();
    const ok = await this.confirmDialog.confirm(
      'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
      { confirmLabel: 'Delete', variant: 'danger' }
    );
    if (!ok) return;

    this.authService.deleteAccount().subscribe({
      next: () => { /* empty */
      },
      error: (err) => {
        console.error('Account deletion failed', err);
        this.errorMessage = 'Failed to delete account. Please try again later.';
      }
    });
  }

  dismissError(): void {
    this.errorMessage = null;
  }
}
