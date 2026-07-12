import {inject, Injectable} from '@angular/core';
import {StorageService} from './storage.service';

export type ChartType = 'pie' | 'bar';

@Injectable({
  providedIn: 'root'
})
export class ChartPreferenceStorageService {
  private readonly PREFERRED_CHART_TYPE = 'app_preferred_chart_type';

  private storage: StorageService = inject(StorageService);

  get preferredChartType(): ChartType {
    return this.storage.get<ChartType>(this.PREFERRED_CHART_TYPE) ?? 'pie';
  }

  setPreferredChartType(type: ChartType): void {
    this.storage.set(this.PREFERRED_CHART_TYPE, type);
  }
}
