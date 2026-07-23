import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'preset',
    data: {scrollable: true},
    loadComponent: () => import('./features/preset/preset.component').then(m => m.PresetComponent)
  },
  {
    path: 'activity',
    data: {scrollable: true},
    loadComponent: () => import('./features/activity/history.component').then(m => m.HistoryComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: '',
    redirectTo: '/home', pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];
