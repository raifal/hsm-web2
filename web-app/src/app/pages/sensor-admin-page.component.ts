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
  saving = false;

  private readonly lineTypeStorageKey = 'sensor-admin.lineTypes';

  lineTypes = [
    { value: 'solid', label: 'Durchgehend' },
    { value: 'dotted', label: 'Gepunktet' },
    { value: 'dashed', label: 'Gestrichelt' }
  ];

  newSensor: SensorRow = {
    sensorAddress: '',
    active: true,
    color: '#f26a2e',
    name: '',
    groupName: '',
    lineType: 'solid',
    _originalAddress: ''
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
            lineType: sensor.lineType || 'solid' as const,
            _originalAddress: sensor.sensorAddress
          }));
          this.loadLineTypes();
        },
        error: () => {
          this.errorMessage = 'Sensoren konnten nicht geladen werden.';
        }
      });
  }

  saveAllSensors(): void {
    this.saving = true;
    this.errorMessage = '';
    let savedCount = 0;
    let errorCount = 0;

    const savePromises = this.sensors.map((sensor) => {
      if (!sensor.sensorAddress.trim()) {
        errorCount++;
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        this.apiService
          .updateSensor(sensor._originalAddress, {
            sensorAddress: sensor.sensorAddress.trim(),
            active: sensor.active,
            color: sensor.color,
            name: sensor.name,
            groupName: sensor.groupName,
            lineType: sensor.lineType || 'solid'
          })
          .subscribe({
            next: (saved) => {
              sensor._originalAddress = saved.sensorAddress;
              sensor.sensorAddress = saved.sensorAddress;
              sensor.name = saved.name;
              sensor.groupName = saved.groupName;
              sensor.color = saved.color;
              sensor.active = saved.active;
              sensor.lineType = saved.lineType || 'solid';
              savedCount++;
              resolve();
            },
            error: () => {
              errorCount++;
              resolve();
            }
          });
      });
    });

    Promise.all(savePromises).then(() => {
      this.saving = false;
      if (errorCount === 0) {
        this.errorMessage = `${savedCount} Sensor(en) erfolgreich gespeichert.`;
      } else {
        this.errorMessage = `${savedCount} gespeichert, ${errorCount} Fehler.`;
      }
    });
  }

  deleteSensor(sensor: SensorRow): void {
    if (!confirm(`Sensor "${sensor.name || sensor.sensorAddress}" wirklich löschen?`)) {
      return;
    }

    this.errorMessage = '';
    this.apiService.deleteSensor(sensor._originalAddress).subscribe({
      next: () => {
        this.sensors = this.sensors.filter((item) => item._originalAddress !== sensor._originalAddress);
      },
      error: () => {
        this.errorMessage = `Sensor ${sensor._originalAddress} konnte nicht gelöscht werden.`;
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
        groupName: this.newSensor.groupName,
        lineType: this.newSensor.lineType || 'solid'
      })
      .subscribe({
        next: (created) => {
          this.sensors = [
            ...this.sensors,
            {
              ...created,
              lineType: created.lineType || 'solid',
              _originalAddress: created.sensorAddress
            }
          ];
          this.saveLineTypes();
          this.newSensor = {
            sensorAddress: '',
            active: true,
            color: '#f26a2e',
            name: '',
            groupName: '',
            lineType: 'solid',
            _originalAddress: ''
          };
        },
        error: () => {
          this.errorMessage = 'Sensor konnte nicht angelegt werden.';
        }
      });
  }

  onLineTypeChanged(): void {
    this.saveLineTypes();
  }

  private saveLineTypes(): void {
    const lineTypes: Record<string, 'solid' | 'dotted' | 'dashed'> = {};
    for (const sensor of this.sensors) {
      lineTypes[sensor.sensorAddress] = sensor.lineType || 'solid';
    }
    localStorage.setItem(this.lineTypeStorageKey, JSON.stringify(lineTypes));
  }

  private loadLineTypes(): void {
    try {
      const stored = localStorage.getItem(this.lineTypeStorageKey);
      if (stored) {
        const lineTypes = JSON.parse(stored) as Record<string, 'solid' | 'dotted' | 'dashed'>;
        for (const sensor of this.sensors) {
          sensor.lineType = lineTypes[sensor.sensorAddress] || 'solid';
        }
      }
    } catch {
      console.error('Error loading line types from localStorage');
    }
  }
}
