import {inject, Injectable} from '@angular/core';
import {StorageService} from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class AppFlowStorageService {
  private readonly LAST_VISITED = 'app_flow_last_visited';

  private storage: StorageService = inject(StorageService);

  get lastVisited(): string | null {
    return this.storage.get<string>(this.LAST_VISITED);
  }

  setLastVisited(route: string): void {
    this.storage.set(this.LAST_VISITED, route);
  }

  reset(): void {
    this.storage.remove(this.LAST_VISITED);
  }

}
