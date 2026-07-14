import {Component, inject, signal} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {filter} from 'rxjs/operators';
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
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  scrollable = signal(false);

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }
        this.scrollable.set(!!route.snapshot.data['scrollable']);
      });
  }
}
