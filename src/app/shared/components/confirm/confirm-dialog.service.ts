import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogRequest {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'danger';
}

/**
 * App-wide replacement for window.confirm().
 *
 * Usage from any component:
 *
 *   private confirmDialog = inject(ConfirmDialogService);
 *
 *   async deleteThing() {
 *     const ok = await this.confirmDialog.confirm('Delete this item?', { variant: 'danger' });
 *     if (ok) { ... }
 *   }
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  public readonly request = signal<ConfirmDialogRequest | null>(null);

  private resolver: ((confirmed: boolean) => void) | null = null;

  confirm(
    message: string,
    options?: Partial<Pick<ConfirmDialogRequest, 'confirmLabel' | 'cancelLabel' | 'variant'>>
  ): Promise<boolean> {
    this.resolver?.(false);

    this.request.set({
      message,
      confirmLabel: options?.confirmLabel ?? 'Confirm',
      cancelLabel: options?.cancelLabel ?? 'Cancel',
      variant: options?.variant ?? 'default'
    });

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  respond(confirmed: boolean): void {
    this.request.set(null);
    this.resolver?.(confirmed);
    this.resolver = null;
  }

}
