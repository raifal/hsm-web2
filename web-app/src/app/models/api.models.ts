export interface SensorRead {
  sensorAddress: string;
  active: boolean;
  color: string;
  name: string;
  groupName: string;
  lineType?: 'solid' | 'dotted' | 'dashed';
}

export interface SensorCreate {
  sensorAddress: string;
  active?: boolean;
  color?: string;
  name?: string;
  groupName?: string;
  lineType?: 'solid' | 'dotted' | 'dashed';
}

export interface MeasurementItem {
  temperature: number;
  timestamp: string;
}

export interface SensorDayMeasurements {
  sensor_address: string;
  measurements: MeasurementItem[];
}
