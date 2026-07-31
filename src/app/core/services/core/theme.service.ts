import {Injectable, inject, signal} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {AppConfigStorageService, Theme} from '../../storage/app-config-storage.service';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private document = inject(DOCUMENT);
  private appConfigStorage = inject(AppConfigStorageService);

  public isDarkMode = signal<boolean>(false);

  constructor() {
    this.loadInitialTheme();
  }

  private loadInitialTheme() {
    const savedTheme = this.appConfigStorage.theme;

    if (savedTheme === 'dark') {
      this.setTheme('dark');
    } else if (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.setTheme('dark');
    } else {
      this.setTheme('light');
    }
  }

  toggleTheme() {
    this.setTheme(this.isDarkMode() ? 'light' : 'dark');
  }

  private setTheme(theme: Theme) {
    this.isDarkMode.set(theme === 'dark');
    this.appConfigStorage.setTheme(theme);

    if (theme === 'dark') {
      this.document.body.setAttribute('data-theme', 'dark');
    } else {
      this.document.body.removeAttribute('data-theme');
    }
  }
}
