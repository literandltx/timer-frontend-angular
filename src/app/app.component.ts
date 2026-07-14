import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {HeaderComponent} from './shared/components/header/header.component';
import {
  ConfirmDialogHostComponent
} from './shared/components/confirm/confirm-dialog-host.component';

@Component({
  selector: 'ns-app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, ConfirmDialogHostComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
}
