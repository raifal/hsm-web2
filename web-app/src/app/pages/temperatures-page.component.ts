import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
    this.rebuildChart();
  }

  private loadPageData(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      sensors: this.apiService.listSensors(),
      measurements: this.apiService.listMeasurementsByDay(this.selectedDate)
    }).subscribe({
      next: ({ sensors, measurements }) => {
        this.activeSensors = sensors.filter((sensor) => sensor.active);
        this.measurementsBySensor = measurements;

        for (const sensor of this.activeSensors) {
          if (this.selectedSensors[sensor.sensorAddress] === undefined) {
            this.selectedSensors[sensor.sensorAddress] = true;
          }
        }

        this.rebuildChart();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Daten konnten nicht geladen werden.';
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
        const color =
          this.activeSensors.find((sensor) => sensor.sensorAddress === sensorAddress)?.color || '#f26a2e';
        const valueByLabel = mapBySensor.get(sensorAddress) ?? new Map<string, number>();
        return {
          label: this.sensorDisplayName(sensorAddress),
          data: labels.map((label) => valueByLabel.get(label) ?? null),
          borderColor: color,
          backgroundColor: `${color}44`,
          tension: 0.2,
          pointRadius: 2,
          borderWidth: 2
        };
      })
    };
  }

  private sensorDisplayName(sensorAddress: string): string {
    const sensor = this.activeSensors.find((item) => item.sensorAddress === sensorAddress);
    if (!sensor) {
      return sensorAddress;
    }

    return sensor.name?.trim() ? `${sensor.name} (${sensor.sensorAddress})` : sensor.sensorAddress;
  }

  private todayIsoDate(): string {
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
}

Chart.register(...registerables);
