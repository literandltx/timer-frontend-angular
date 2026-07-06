import {Routes} from '@angular/router';
import {HomeComponent} from './features/home/home.component';
import {RegisterComponent} from './features/register/register.component';
import {LoginComponent} from './features/login/login.component';
import {HistoryComponent} from './features/history/history.component';
import {PresetComponent} from './features/preset/preset.component';

export const routes: Routes = [
  {path: 'home', component: HomeComponent},
  {path: 'preset', component: PresetComponent},
  {path: 'history', component: HistoryComponent},
  {path: 'register', component: RegisterComponent},
  {path: 'login', component: LoginComponent},
  {path: '', redirectTo: '/home', pathMatch: 'full'},
  {path: '**', redirectTo: '/home'}
];
