import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SensorRead } from '../models/api.models';
import { ApiService } from '../services/api.service';

interface SensorRow extends SensorRead {
  _originalAddress: string;
}

@Component({
  selector: 'app-sensor-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sensor-admin-page.component.html',
  styleUrl: './sensor-admin-page.component.scss'
})
export class SensorAdminPageComponent implements OnInit {
  sensors: SensorRow[] = [];
  loading = false;
  errorMessage = '';

  newSensor: SensorRead = {
    sensorAddress: '',
    active: true,
    color: '#f26a2e',
    name: '',
    groupName: ''
  };

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.reloadSensors();
  }

  reloadSensors(): void {
    this.loading = true;
    this.errorMessage = '';

    this.apiService
      .listSensors()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (sensors) => {
          this.sensors = sensors.map((sensor) => ({
            ...sensor,
            _originalAddress: sensor.sensorAddress
          }));
        },
        error: () => {
          this.errorMessage = 'Sensoren konnten nicht geladen werden.';
        }
      });
  }

  saveSensor(sensor: SensorRow): void {
    if (!sensor.sensorAddress.trim()) {
      this.errorMessage = 'SensorAddress darf nicht leer sein.';
      return;
    }

    this.errorMessage = '';
    this.apiService
      .updateSensor(sensor._originalAddress, {
        sensorAddress: sensor.sensorAddress.trim(),
        active: sensor.active,
        color: sensor.color,
        name: sensor.name,
        groupName: sensor.groupName
      })
      .subscribe({
        next: (saved) => {
          sensor._originalAddress = saved.sensorAddress;
          sensor.sensorAddress = saved.sensorAddress;
          sensor.name = saved.name;
          sensor.groupName = saved.groupName;
          sensor.color = saved.color;
          sensor.active = saved.active;
        },
        error: () => {
          this.errorMessage = `Sensor ${sensor._originalAddress} konnte nicht gespeichert werden.`;
          this.reloadSensors();
        }
      });
  }

  deleteSensor(sensor: SensorRow): void {
    this.errorMessage = '';
    this.apiService.deleteSensor(sensor._originalAddress).subscribe({
      next: () => {
        this.sensors = this.sensors.filter((item) => item._originalAddress !== sensor._originalAddress);
      },
      error: () => {
        this.errorMessage = `Sensor ${sensor._originalAddress} konnte nicht geloescht werden.`;
      }
    });
  }

  addSensor(): void {
    if (!this.newSensor.sensorAddress.trim()) {
      this.errorMessage = 'Neue SensorAddress darf nicht leer sein.';
      return;
    }

    this.errorMessage = '';
    this.apiService
      .createSensor({
        sensorAddress: this.newSensor.sensorAddress.trim(),
        active: this.newSensor.active,
        color: this.newSensor.color,
        name: this.newSensor.name,
        groupName: this.newSensor.groupName
      })
      .subscribe({
        next: (created) => {
          this.sensors = [
            ...this.sensors,
            {
              ...created,
              _originalAddress: created.sensorAddress
            }
          ];
          this.newSensor = {
            sensorAddress: '',
            active: true,
            color: '#f26a2e',
            name: '',
            groupName: ''
          };
        },
        error: () => {
          this.errorMessage = 'Sensor konnte nicht angelegt werden.';
        }
      });
  }
}
