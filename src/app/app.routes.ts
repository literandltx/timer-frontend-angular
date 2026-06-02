import {Routes} from '@angular/router';
import {HomeComponent} from './features/home/home.component';
import {TimerListComponent} from './features/timers/timer-list.component';
import {RegisterComponent} from './features/register/register.component';
import {LoginComponent} from './features/login/login.component';
import {LabelListComponent} from './features/labels/label-list.component';
import {HistoryComponent} from './features/history/history.component';

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
