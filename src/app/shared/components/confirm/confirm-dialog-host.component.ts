import {Component, inject} from '@angular/core';
import {ConfirmDialogService} from './confirm-dialog.service';

@Component({
  selector: 'ns-confirm-dialog-host',
  standalone: true,
  templateUrl: './confirm-dialog-host.component.html',
  styleUrl: './confirm-dialog-host.component.css'
})
export class ConfirmDialogHostComponent {
  public dialogService = inject(ConfirmDialogService);

  onConfirm(): void {
    this.dialogService.respond(true);
  }

  onCancel(): void {
    this.dialogService.respond(false);
  }

}
