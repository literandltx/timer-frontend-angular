import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../../../environments/environment';
import {TimerSettingRequest, TimerSetting} from '../models/timer-setting.model';

@Injectable({providedIn: 'root'})
export class TimerSettingApiService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.base_url}/api/v1/timer-settings`;

  save(request: TimerSettingRequest): Observable<TimerSetting> {
    return this.http.put<TimerSetting>(this.baseUrl, request);
  }

  pullUpdates(updatedAfter?: string): Observable<TimerSetting> {
    let url = `${this.baseUrl}/sync`;

    if (updatedAfter) {
      url += `?updatedAfter=${updatedAfter}`;
    }

    return this.http.get<TimerSetting>(url);
  }
}
