import { Routes } from '@angular/router';
import { SensorAdminPageComponent } from './pages/sensor-admin-page.component';
import { TemperaturesPageComponent } from './pages/temperatures-page.component';

export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'temperaturen'
	},
	{
		path: 'temperaturen',
		component: TemperaturesPageComponent
	},
	{
		path: 'sensor-admin',
		component: SensorAdminPageComponent
	},
	{
		path: '**',
		redirectTo: 'temperaturen'
	}
];
