import {Component, inject, HostListener, ElementRef, signal} from '@angular/core';
import {RouterLink, RouterLinkActive, Router} from '@angular/router';
import {DOCUMENT} from '@angular/common';
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
  private document = inject(DOCUMENT);
  private router = inject(Router);

  public isUserMenuOpen = false;
  public isFullscreen = signal(false);

  private readonly navRoutes = ['/preset', '/home', '/history'];
  private touchStartX = 0;
  private touchEndX = 0;
  private readonly swipeThreshold = 50;

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
    this.touchStartX = event.changedTouches[0].screenX;
  }

  @HostListener('window:touchend', ['$event'])
  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  private handleSwipe() {
    const distance = this.touchStartX - this.touchEndX;

    if (distance > this.swipeThreshold) {
      this.navigateNext();
    } else if (distance < -this.swipeThreshold) {
      this.navigatePrev();
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
    console.log("Apply logout")
    this.closeUserMenu();
    this.authService.logout().subscribe();
  }

  deleteAccount() {
    console.log("Apply deleteAccount")
    this.closeUserMenu();

    const isConfirmed = confirm('Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.');

    if (isConfirmed) {
      this.authService.deleteAccount();
    }
  }
}
