const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

let sensors = [
  {
    sensorAddress: '28-0001',
    active: true,
    color: '#f26a2e',
    name: 'Boiler 1',
    groupName: 'Heizkreis'
  },
  {
    sensorAddress: '28-0002',
    active: true,
    color: '#4aaa82',
    name: 'Ruecklauf',
    groupName: 'Heizkreis'
  },
  {
    sensorAddress: '28-0003',
    active: false,
    color: '#3f8ec9',
    name: 'Aussen',
    groupName: 'Umgebung'
  }
];

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'mock-api' });
});

app.get('/api/sensors', (req, res) => {
  res.json(sensors);
});

app.post('/api/sensors', (req, res) => {
  const payload = req.body || {};
  const sensorAddress = String(payload.sensorAddress || '').trim();

  if (!sensorAddress) {
    return res.status(400).json({ message: 'sensorAddress is required' });
  }

  if (sensors.some((sensor) => sensor.sensorAddress === sensorAddress)) {
    return res.status(409).json({ message: 'sensor already exists' });
  }

  const created = {
    sensorAddress,
    active: payload.active ?? true,
    color: payload.color ?? '#f26a2e',
    name: payload.name ?? '',
    groupName: payload.groupName ?? ''
  };

  sensors.push(created);
  return res.json(created);
});

app.get('/api/sensors/:sensorAddress', (req, res) => {
  const found = sensors.find((sensor) => sensor.sensorAddress === req.params.sensorAddress);
  if (!found) {
    return res.status(404).json({ message: 'sensor not found' });
  }

  return res.json(found);
});

app.put('/api/sensors/:sensorAddress', (req, res) => {
  const index = sensors.findIndex((sensor) => sensor.sensorAddress === req.params.sensorAddress);
  if (index === -1) {
    return res.status(404).json({ message: 'sensor not found' });
  }

  const payload = req.body || {};
  const nextAddress = String(payload.sensorAddress || '').trim();
  if (!nextAddress) {
    return res.status(400).json({ message: 'sensorAddress is required' });
  }

  const duplicate = sensors.find(
    (sensor, duplicateIndex) =>
      sensor.sensorAddress === nextAddress && duplicateIndex !== index
  );
  if (duplicate) {
    return res.status(409).json({ message: 'sensorAddress already exists' });
  }

  const updated = {
    sensorAddress: nextAddress,
    active: payload.active ?? true,
    color: payload.color ?? '#f26a2e',
    name: payload.name ?? '',
    groupName: payload.groupName ?? ''
  };

  sensors[index] = updated;
  return res.json(updated);
});

app.delete('/api/sensors/:sensorAddress', (req, res) => {
  sensors = sensors.filter((sensor) => sensor.sensorAddress !== req.params.sensorAddress);
  return res.json({ success: true });
});

app.get('/api/measurements/day/:target_date', (req, res) => {
  const date = req.params.target_date;
  const body = sensors.map((sensor, index) => {
    const measurements = [];

    for (let hour = 0; hour < 24; hour += 1) {
      const timestamp = `${date}T${String(hour).padStart(2, '0')}:00:00Z`;
      const temperature = Number((19 + Math.sin((hour + index * 3) / 3) * 5 + index).toFixed(2));
      measurements.push({
        timestamp,
        temperature
      });
    }

    return {
      sensor_address: sensor.sensorAddress,
      measurements
    };
  });

  res.json(body);
});

app.listen(port, () => {
  console.log(`Mock API listening on ${port}`);
});
