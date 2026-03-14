import {Routes} from '@angular/router';
import {HomeComponent} from './feature/home/home.component';
import {TimerListComponent} from './feature/timer/list/timer-list.component';
import {RegisterComponent} from './feature/auth/register/register.component';
import {LoginComponent} from './feature/auth/login/login.component';
import {LabelListComponent} from './feature/labels/label-list.component';
import {HistoryComponent} from './feature/history/history.component';

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
