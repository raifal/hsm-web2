import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SensorCreate, SensorDayMeasurements, SensorRead } from '../models/api.models';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(
    private readonly http: HttpClient,
    private readonly runtimeConfigService: RuntimeConfigService
  ) {}

  listSensors(): Observable<SensorRead[]> {
    return this.http.get<SensorRead[]>(this.url('/api/sensors'), { headers: this.headers() });
  }

  createSensor(payload: SensorCreate): Observable<SensorRead> {
    return this.http.post<SensorRead>(this.url('/api/sensors'), payload, { headers: this.headers() });
  }

  updateSensor(currentAddress: string, payload: SensorCreate): Observable<SensorRead> {
    return this.http.put<SensorRead>(this.url(`/api/sensors/${encodeURIComponent(currentAddress)}`), payload, {
      headers: this.headers()
    });
  }

  deleteSensor(sensorAddress: string): Observable<void> {
    return this.http.delete<void>(this.url(`/api/sensors/${encodeURIComponent(sensorAddress)}`), {
      headers: this.headers()
    });
  }

  listMeasurementsByDay(targetDate: string): Observable<SensorDayMeasurements[]> {
    return this.http.get<SensorDayMeasurements[]>(
      this.url(`/api/measurements/day/${encodeURIComponent(targetDate)}`),
      {
        headers: this.headers()
      }
    );
  }

  private url(path: string): string {
    const config = this.runtimeConfigService.config;
    // In mock mode, route via the web container reverse proxy to avoid browser cross-origin issues.
    const baseUrl = config.useMockApi ? '' : config.apiBaseUrl;
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }

  private headers(): HttpHeaders {
    const config = this.runtimeConfigService.config;
    const username = config.basicAuth.username;

    if (!username) {
      return new HttpHeaders();
    }

    const token = btoa(`${username}:${config.basicAuth.password ?? ''}`);
    return new HttpHeaders({
      Authorization: `Basic ${token}`
    });
  }
}
