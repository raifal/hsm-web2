import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin } from 'rxjs';
import { SensorDayMeasurements, SensorRead } from '../models/api.models';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-temperatures-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './temperatures-page.component.html',
  styleUrl: './temperatures-page.component.scss'
})
export class TemperaturesPageComponent implements OnInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  private readonly sensorSelectionStorageKey = 'temperatures.selectedSensors';
  private readonly lineTypeStorageKey = 'sensor-admin.lineTypes';

  selectedDate = this.todayIsoDate();
  activeSensors: SensorRead[] = [];
  selectedSensors: Record<string, boolean> = {};
  measurementsBySensor: SensorDayMeasurements[] = [];
  errorMessage = '';
  loading = false;

  lineChartType: 'line' = 'line';
  lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };

  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    },
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Temperatur (C)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Uhrzeit'
        }
      }
    }
  };

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.loadPageData();
  }

  onDateChanged(): void {
    this.loadMeasurements();
  }

  onSensorSelectionChanged(): void {
    this.saveSensorSelection();
    this.rebuildChart();
  }

  previousDay(): void {
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() - 1);
    this.selectedDate = date.toISOString().slice(0, 10);
    this.onDateChanged();
  }

  nextDay(): void {
    if (this.isMaxDateReached()) {
      return;
    }
    const date = new Date(this.selectedDate);
    date.setDate(date.getDate() + 1);
    this.selectedDate = date.toISOString().slice(0, 10);
    this.onDateChanged();
  }

  goToToday(): void {
    this.selectedDate = this.todayIsoDate();
    this.onDateChanged();
  }

  isMaxDateReached(): boolean {
    return this.selectedDate >= this.todayIsoDate();
  }

  exportAsImage(): void {
    const canvas = this.chart?.chart?.canvas;
    if (!canvas) {
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `temperaturen-${this.selectedDate}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private loadPageData(): void {
    console.log('Loading page data..., selectedDate:', this.selectedDate);
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      sensors: this.apiService.listSensors(),
      measurements: this.apiService.listMeasurementsByDay(this.selectedDate)
    }).subscribe({
      next: ({ sensors, measurements }) => {
        console.log('Data loaded successfully. Sensors:', sensors, 'Measurements:', measurements);
        this.activeSensors = sensors.filter((sensor) => sensor.active);
        this.measurementsBySensor = measurements;
        const persistedSelection = this.loadSensorSelection();

        for (const sensor of this.activeSensors) {
          const persistedValue = persistedSelection[sensor.sensorAddress];
          this.selectedSensors[sensor.sensorAddress] = persistedValue ?? true;
        }

        this.saveSensorSelection();

        this.rebuildChart();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.loading = false;
        this.errorMessage = 'Daten konnten nicht geladen werden. Fehler: ' + (err?.message || JSON.stringify(err));
      }
    });
  }

  private loadMeasurements(): void {
    this.loading = true;
    this.errorMessage = '';

    this.apiService.listMeasurementsByDay(this.selectedDate).subscribe({
      next: (measurements) => {
        this.measurementsBySensor = measurements;
        this.rebuildChart();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Messwerte fuer den Tag konnten nicht geladen werden.';
      }
    });
  }

  private rebuildChart(): void {
    const labels = this.dayLabels();

    const selectedSensorAddresses = this.activeSensors
      .filter((sensor) => this.selectedSensors[sensor.sensorAddress])
      .map((sensor) => sensor.sensorAddress);

    const mapBySensor = new Map<string, Map<string, number>>();

    for (const sensorAddress of selectedSensorAddresses) {
      const group = this.measurementsBySensor.find((item) => item.sensor_address === sensorAddress);
      const valueByLabel = new Map<string, number>();

      if (group) {
        const sortedMeasurements = [...group.measurements].sort((a, b) =>
          a.timestamp.localeCompare(b.timestamp)
        );
        for (const measurement of sortedMeasurements) {
          const label = this.timeLabel(measurement.timestamp);
          valueByLabel.set(label, measurement.temperature);
        }
      }

      mapBySensor.set(sensorAddress, valueByLabel);
    }

    this.lineChartData = {
      labels,
      datasets: selectedSensorAddresses.map((sensorAddress) => {
        const sensor = this.activeSensors.find((s) => s.sensorAddress === sensorAddress);
        const color = sensor?.color || '#f26a2e';
        const valueByLabel = mapBySensor.get(sensorAddress) ?? new Map<string, number>();
        const lineType = sensor?.lineType || this.getLineTypesMap()[sensorAddress] || 'solid';
        const borderDash = this.getLineDash(lineType);

        return {
          label: this.sensorDisplayName(sensorAddress),
          data: labels.map((label) => valueByLabel.get(label) ?? null),
          borderColor: color,
          backgroundColor: `${color}44`,
          showLine: true,
          spanGaps: true,
          tension: 0.2,
          pointRadius: 1,
          borderWidth: 1,
          borderDash
        };
      })
    };
  }

  private sensorDisplayName(sensorAddress: string): string {
    const sensor = this.activeSensors.find((item) => item.sensorAddress === sensorAddress);
    if (!sensor) {
      return sensorAddress;
    }

    return sensor.name?.trim() ? sensor.name : sensor.sensorAddress;
  }

  private getLineTypesMap(): Record<string, 'solid' | 'dotted' | 'dashed'> {
    try {
      const stored = localStorage.getItem(this.lineTypeStorageKey);
      if (stored) {
        return JSON.parse(stored) as Record<string, 'solid' | 'dotted' | 'dashed'>;
      }
    } catch {
      console.error('Error loading line types from localStorage');
    }
    return {};
  }

  private getLineDash(lineType: 'solid' | 'dotted' | 'dashed'): number[] {
    switch (lineType) {
      case 'dotted':
        return [2, 3];
      case 'dashed':
        return [5, 5];
      case 'solid':
      default:
        return [];
    }
  }

  todayIsoDate(): string {
    const date = new Date();
    return date.toISOString().slice(0, 10);
  }

  private timeLabel(isoDateTime: string): string {
    return new Date(isoDateTime).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private dayLabels(): string[] {
    const labels: string[] = [];

    for (let minuteOfDay = 0; minuteOfDay < 24 * 60; minuteOfDay++) {
      const hour = Math.floor(minuteOfDay / 60);
      const minute = minuteOfDay % 60;
      labels.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }

    labels.push('24:00');

    return labels;
  }

  private loadSensorSelection(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem(this.sensorSelectionStorageKey);
      if (!raw) {
        return {};
      }

      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }

      return Object.entries(parsed).reduce<Record<string, boolean>>((accumulator, [key, value]) => {
        if (typeof value === 'boolean') {
          accumulator[key] = value;
        }
        return accumulator;
      }, {});
    } catch {
      return {};
    }
  }

  private saveSensorSelection(): void {
    try {
      const selectionForActiveSensors = this.activeSensors.reduce<Record<string, boolean>>(
        (accumulator, sensor) => {
          accumulator[sensor.sensorAddress] = this.selectedSensors[sensor.sensorAddress] ?? true;
          return accumulator;
        },
        {}
      );

      localStorage.setItem(this.sensorSelectionStorageKey, JSON.stringify(selectionForActiveSensors));
    } catch {
      // Ignore storage errors, e.g. privacy mode.
    }
  }
}

Chart.register(...registerables);
