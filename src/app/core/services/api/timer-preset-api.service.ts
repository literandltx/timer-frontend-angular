import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../../../environments/environment';
import {TimerPresetRequest, TimerPreset} from '../../models/timer-setting.model';

@Injectable({providedIn: 'root'})
export class TimerPresetApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.base_url}/api/v1/timer-presets`;

  save(request: TimerPresetRequest): Observable<TimerPreset> {
    return this.http.put<TimerPreset>(this.baseUrl, request);
  }

  pullUpdates(updatedAfter?: string): Observable<TimerPreset> {
    let url = `${this.baseUrl}/sync`;

    if (updatedAfter) {
      url += `?updatedAfter=${updatedAfter}`;
    }

    return this.http.get<TimerPreset>(url);
  }
}
