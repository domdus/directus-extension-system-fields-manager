import { defineModule } from '@directus/extensions-sdk';
import { userHasAdminAccess } from '../shared/admin';
import FilesView from './files-view.vue';
import { installFilePreviewEnforcer } from './file-preview-enforcer';
import SettingsView from './settings-view.vue';
import UsersView from './users-view.vue';

// App extension bundle loads for every Data Studio session — install preview enforcer globally.
installFilePreviewEnforcer();

export default defineModule({
	id: 'system-fields-manager',
	name: 'System Fields Manager',
	icon: 'tune',
	routes: [
		{
			path: '',
			redirect: '/system-fields-manager/users',
		},
		{
			path: 'files',
			component: FilesView,
		},
		{
			path: 'users',
			component: UsersView,
		},
		{
			path: 'settings',
			component: SettingsView,
		},
	],
	preRegisterCheck(user) {
		return userHasAdminAccess(user);
	},
});
