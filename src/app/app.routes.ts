import {Routes} from '@angular/router';
import {HomeComponent} from './pages/home/home.component';
import {TimerListComponent} from './pages/timers/timer-list.component';
import {RegisterComponent} from './pages/register/register.component';
import {LoginComponent} from './pages/login/login.component';
import {LabelListComponent} from './pages/labels/label-list.component';
import {HistoryComponent} from './pages/history/history.component';

export const routes: Routes = [
  {path: 'home', component: HomeComponent},
  {path: 'timer-list', component: TimerListComponent},
  {path: 'label-list', component: LabelListComponent},
  {path: 'history', component: HistoryComponent},
  {path: 'register', component: RegisterComponent},
  {path: 'login', component: LoginComponent},
  {path: '', redirectTo: '/home', pathMatch: 'full'},
  {path: '**', redirectTo: '/home'}
];
