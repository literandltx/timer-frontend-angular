import {Injectable, inject, signal} from '@angular/core';
import {DOCUMENT} from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private document = inject(DOCUMENT);

  public isDarkMode = signal<boolean>(false);

  constructor() {
    this.loadInitialTheme();
  }

  private loadInitialTheme() {
    const savedTheme = localStorage.getItem('theme');

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

  private setTheme(theme: 'light' | 'dark') {
    this.isDarkMode.set(theme === 'dark');
    localStorage.setItem('theme', theme);

    if (theme === 'dark') {
      this.document.body.setAttribute('data-theme', 'dark');
    } else {
      this.document.body.removeAttribute('data-theme');
    }
  }
}
