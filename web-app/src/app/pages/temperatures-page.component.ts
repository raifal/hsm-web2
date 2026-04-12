import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, ChartData, LegendItem, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin } from 'rxjs';
import { SensorDayMeasurements, SensorRead } from '../models/api.models';
import { ApiService } from '../services/api.service';

interface SensorGroup {
  name: string;
  sensors: SensorRead[];
}

@Component({
  selector: 'app-temperatures-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './temperatures-page.component.html',
  styleUrl: './temperatures-page.component.scss'
})
export class TemperaturesPageComponent implements OnInit {
  private readonly sensorSelectionStorageKey = 'temperatures.selectedSensors';
  private readonly lineTypeStorageKey = 'sensor-admin.lineTypes';
  private readonly ungroupedLabel = 'Ohne Gruppe';

  selectedDate = this.todayIsoDate();
  activeSensors: SensorRead[] = [];
  sensorGroups: SensorGroup[] = [];
  selectedSensors: Record<string, boolean> = {};
  measurementsBySensor: SensorDayMeasurements[] = [];
  errorMessage = '';
  loading = false;
  showSensorFilterModal = false;
  private datasetGroupNames: string[] = [];
  private datasetLegendColors: string[] = [];

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
        position: 'bottom',
        labels: {
          generateLabels: (chart) => this.buildGroupLegendLabels(chart)
        },
        onClick: (_event, legendItem, legend) => {
          this.toggleGroupDatasets(legend.chart, legendItem.text);
        }
      }
    },
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    scales: {
      y: {
        suggestedMax: 80,
        suggestedMin: -20,
        title: {
          display: true,
          text: 'Temperatur (C)'
        }
      },
      x: {
        grid: {
          color: (context) => {
            const label = this.lineChartData.labels?.[context.index];
            if (typeof label !== 'string') {
              return 'rgba(0, 0, 0, 0)';
            }

            if (label === '24:00') {
              return 'rgba(31, 43, 45, 0.16)';
            }

            return label.endsWith(':00') ? 'rgba(31, 43, 45, 0.16)' : 'rgba(0, 0, 0, 0)';
          }
        },
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          callback: (_value, index) => {
            if (typeof index !== 'number') {
              return '';
            }
            const label = this.lineChartData.labels?.[index];
            if (typeof label !== 'string') {
              return '';
            }

            if (label === '24:00') {
              return '24h';
            }

            const [hour, minute] = label.split(':');
            if (minute === '00') {
              return `${Number(hour)}h`;
            }

            return '';
          }
        },
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

  onGroupSelectionChanged(groupName: string, selected: boolean): void {
    for (const sensor of this.activeSensors) {
      if (this.sensorGroupName(sensor) === groupName) {
        this.selectedSensors[sensor.sensorAddress] = selected;
      }
    }

    this.onSensorSelectionChanged();
  }

  isGroupSelected(groupName: string): boolean {
    const groupSensors = this.activeSensors.filter((sensor) => this.sensorGroupName(sensor) === groupName);
    if (groupSensors.length === 0) {
      return false;
    }

    return groupSensors.every((sensor) => this.selectedSensors[sensor.sensorAddress]);
  }

  isGroupPartiallySelected(groupName: string): boolean {
    const groupSensors = this.activeSensors.filter((sensor) => this.sensorGroupName(sensor) === groupName);
    if (groupSensors.length === 0) {
      return false;
    }

    const selectedCount = groupSensors.filter((sensor) => this.selectedSensors[sensor.sensorAddress]).length;
    return selectedCount > 0 && selectedCount < groupSensors.length;
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

  toggleSensorFilter(): void {
    this.showSensorFilterModal = !this.showSensorFilterModal;
  }

  closeSensorFilter(): void {
    this.showSensorFilterModal = false;
  }

  isMaxDateReached(): boolean {
    return this.selectedDate >= this.todayIsoDate();
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
        this.sensorGroups = this.buildSensorGroups(this.activeSensors);
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

    const selectedGroups = this.sensorGroups
      .map((group) => ({
        name: group.name,
        sensors: group.sensors.filter((sensor) => this.selectedSensors[sensor.sensorAddress])
      }))
      .filter((group) => group.sensors.length > 0);

    const selectedSensorAddresses = selectedGroups.flatMap((group) =>
      group.sensors.map((sensor) => sensor.sensorAddress)
    );

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

    const datasets: ChartData<'line'>['datasets'] = [];
    this.datasetGroupNames = [];
    this.datasetLegendColors = [];
    const lineTypes = this.getLineTypesMap();

    for (const group of selectedGroups) {
      const shouldFillBetweenLines = group.sensors.length === 2;
      const areaColor = shouldFillBetweenLines
        ? this.hexColorWithAlpha(group.sensors[0]?.color || '#f26a2e', '30')
        : '';

      for (let index = 0; index < group.sensors.length; index += 1) {
        const sensor = group.sensors[index];
        const sensorAddress = sensor.sensorAddress;
        const color = sensor.color || '#f26a2e';
        const valueByLabel = mapBySensor.get(sensorAddress) ?? new Map<string, number>();
        const lineType = sensor.lineType || lineTypes[sensorAddress] || 'solid';
        const borderDash = this.getLineDash(lineType);
        const legendColor = areaColor || this.hexColorWithAlpha(color, '30');

        this.datasetGroupNames.push(group.name);
        this.datasetLegendColors.push(legendColor);

        datasets.push({
          label: this.sensorDisplayName(sensorAddress),
          data: labels.map((label) => valueByLabel.get(label) ?? null),
          borderColor: color,
          backgroundColor: shouldFillBetweenLines && index === 1 ? areaColor : `${color}44`,
          fill: shouldFillBetweenLines && index === 1 ? '-1' : false,
          showLine: true,
          spanGaps: true,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 2,
          borderWidth: 1,
          borderDash
        });
      }
    }

    this.lineChartData = {
      labels,
      datasets
    };
  }

  private sensorDisplayName(sensorAddress: string): string {
    const sensor = this.activeSensors.find((item) => item.sensorAddress === sensorAddress);
    if (!sensor) {
      return sensorAddress;
    }

    return sensor.name?.trim() ? sensor.name : sensor.sensorAddress;
  }

  private sensorGroupName(sensor: SensorRead): string {
    return sensor.groupName?.trim() || this.ungroupedLabel;
  }

  private buildSensorGroups(sensors: SensorRead[]): SensorGroup[] {
    const grouped = new Map<string, SensorRead[]>();

    for (const sensor of sensors) {
      const groupName = this.sensorGroupName(sensor);
      const list = grouped.get(groupName);
      if (list) {
        list.push(sensor);
        continue;
      }
      grouped.set(groupName, [sensor]);
    }

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'de', { sensitivity: 'base' }))
      .map(([name, groupSensors]) => ({
        name,
        sensors: groupSensors.sort((left, right) => this.sensorDisplaySortKey(left).localeCompare(this.sensorDisplaySortKey(right), 'de', { sensitivity: 'base' }))
      }));
  }

  private sensorDisplaySortKey(sensor: SensorRead): string {
    return sensor.name?.trim() || sensor.sensorAddress;
  }

  private hexColorWithAlpha(color: string, alphaHex: string): string {
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      return `${color}${alphaHex}`;
    }
    if (/^#[0-9a-fA-F]{8}$/.test(color)) {
      return `${color.slice(0, 7)}${alphaHex}`;
    }
    return `#f26a2e${alphaHex}`;
  }

  private buildGroupLegendLabels(chart: Chart): LegendItem[] {
    const groupItems = new Map<string, LegendItem>();

    chart.data.datasets.forEach((_dataset, datasetIndex) => {
      const groupName = this.datasetGroupNames[datasetIndex];
      if (!groupName || groupItems.has(groupName)) {
        return;
      }

      const legendColor = this.datasetLegendColors[datasetIndex] || '#f26a2e30';
      const isVisible = chart.isDatasetVisible(datasetIndex);

      groupItems.set(groupName, {
        text: groupName,
        fillStyle: legendColor,
        strokeStyle: legendColor,
        lineWidth: 2,
        hidden: !isVisible,
        datasetIndex
      });
    });

    return [...groupItems.values()];
  }

  private toggleGroupDatasets(chart: Chart, groupName: string): void {
    const targetIndexes: number[] = [];

    chart.data.datasets.forEach((_dataset, index) => {
      if (this.datasetGroupNames[index] === groupName) {
        targetIndexes.push(index);
      }
    });

    if (targetIndexes.length === 0) {
      return;
    }

    const shouldShow = targetIndexes.some((index) => !chart.isDatasetVisible(index));
    for (const index of targetIndexes) {
      chart.setDatasetVisibility(index, shouldShow);
    }
    chart.update();
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

    for (let minuteOfDay = 0; minuteOfDay < 24 * 60; minuteOfDay += 1) {
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
