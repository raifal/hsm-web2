# hsm-web2

Angular Webanwendung fuer Temperaturauswertung und Sensor-Administration inkl. Mock REST API.

## Komponenten

- `web-app/`: Angular Frontend mit den Seiten `Temperaturen` und `Sensor Administration`
- `mock-api/`: Mock REST Service auf `localhost:8000`
- `docker-compose.yml`: startet Frontend + Mock Service

## Konfiguration per `hsm-web.properties`

Die Anwendung liest beim Start die Datei `hsm-web.properties` aus dem Docker-Volume-Mount.

Beispiel (`external-interface/hsm-web.properties`):

```properties
apiBaseUrl=http://localhost:8000
useMockApi=true
basicAuth.username=
basicAuth.password=
```

- `useMockApi=true`: Frontend verwendet den Mock Service ueber denselben Origin (`/api` via Nginx-Proxy)
- `useMockApi=false`: Frontend verwendet `apiBaseUrl` und optional Basic Auth

## Start mit Docker Compose

```bash
cd /workspaces/hsm-web2
GIT_COMMIT=$(git rev-parse --short HEAD) BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ) docker compose up --build
```

Frontend:

- `http://localhost:4200`

Mock API:

- `http://localhost:8000`

Hinweis:

- Fuer das Frontend wird der Mock bei `useMockApi=true` intern ueber `http://localhost:4200/api/...` geroutet.

### Andere Property-Datei verwenden

```bash
HSM_PROPERTIES_FILE=./external-interface/hsm-web.properties docker compose up --build
```

`HSM_PROPERTIES_FILE` kann auf jede beliebige Property-Datei zeigen.

## Features

- Linke Navigation mit Logo, Menuepunkten und Footer (`git commit`, `build timestamp`)
- Seite `Sensor Administration` mit kompletter Sensor-CRUD-Tabelle (anlegen, bearbeiten, loeschen)
- Seite `Temperaturen` mit Liniendiagramm pro aktivem Sensor
- Datepicker fuer Tagesauswahl (Default: heute)
- Checkbox-Liste zum Ein-/Ausblenden einzelner aktiver Sensoren