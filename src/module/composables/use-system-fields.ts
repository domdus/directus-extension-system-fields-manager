import { useApi, useStores } from '@directus/extensions-sdk';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { fieldLabel } from '../../shared/catalogs';
import { createDefaultLayout, normalizeConfig, serializeConfig } from '../../shared/evaluate';
import { userHasAdminAccess } from '../../shared/admin';
import {
	EMPTY_SYSTEM_FIELDS,
	FILE_PREVIEW_FIELD,
	SYSTEM_FIELDS_FIELD,
	type CollectionFieldLayout,
	type FieldLayoutEntry,
	type FieldWidth,
	type SupportedCollection,
	type SystemFieldsConfig,
} from '../../shared/types';

function cloneDeep<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function isEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** Resolve Directus `$t:key` labels (e.g. policy name `$t:public_label`). */
function resolveTranslatedLabel(raw: unknown, translate: (key: string) => string): string {
	if (typeof raw !== 'string') return String(raw ?? '');
	if (!raw.startsWith('$t:')) return raw;

	const key = raw.slice(3).trim();
	if (!key) return raw;

	try {
		const translated = translate(key);
		if (translated && translated !== key) return translated;
	} catch {
		// ignore
	}

	return key;
}

const loading = ref(true);
const saving = ref(false);
const cleaning = ref(false);
const config = ref<SystemFieldsConfig>(cloneDeep(EMPTY_SYSTEM_FIELDS));
const initialConfig = ref<SystemFieldsConfig>(cloneDeep(EMPTY_SYSTEM_FIELDS));
const roleOptions = ref<{ text: string; value: string }[]>([]);
const policyOptions = ref<{ text: string; value: string }[]>([]);

const layoutEditing = ref<{ collection: SupportedCollection; id: string } | null>(null);
const layoutDraft = ref<CollectionFieldLayout | null>(null);

let loadPromise: Promise<void> | null = null;

export function useSystemFields() {
	const api = useApi();
	const { t } = useI18n();
	const { useSettingsStore, useUserStore } = useStores();
	const settingsStore = useSettingsStore();
	const userStore = useUserStore();

	const hasEdits = computed(() => !isEqual(serializeConfig(config.value), serializeConfig(initialConfig.value)));

	function layoutsFor(collection: SupportedCollection) {
		return computed<CollectionFieldLayout[]>({
			get() {
				return config.value.collections[collection] || [];
			},
			set(value: CollectionFieldLayout[]) {
				config.value = {
					...config.value,
					version: 1,
					collections: {
						...config.value.collections,
						[collection]: value,
					},
				};
			},
		});
	}

	function layoutSummary(layout: CollectionFieldLayout): string {
		const roleCount = layout.roles?.length ?? 0;
		const policyCount = layout.policies?.length ?? 0;
		const fieldCount = layout.fields?.length ?? 0;
		const visible = (layout.fields || []).filter((entry) => entry.show !== false).length;

		if (roleCount === 0 && policyCount === 0) {
			return `Catch-all · ${visible}/${fieldCount} fields`;
		}

		return `${roleCount} role(s) · ${policyCount} polic(ies) · ${visible}/${fieldCount} fields`;
	}

	function addLayout(collection: SupportedCollection) {
		const next = createDefaultLayout(collection, crypto.randomUUID());
		const list = [...(config.value.collections[collection] || []), next];
		config.value = {
			...config.value,
			version: 1,
			collections: {
				...config.value.collections,
				[collection]: list,
			},
		};
		openLayoutEditor(collection, next.id);
	}

	function removeLayout(collection: SupportedCollection, id: string) {
		config.value = {
			...config.value,
			version: 1,
			collections: {
				...config.value.collections,
				[collection]: (config.value.collections[collection] || []).filter((layout) => layout.id !== id),
			},
		};

		if (layoutEditing.value?.collection === collection && layoutEditing.value?.id === id) {
			closeLayoutEditor();
		}
	}

	function openLayoutEditor(collection: SupportedCollection, id: string) {
		const existing = (config.value.collections[collection] || []).find((layout) => layout.id === id);
		if (!existing) return;
		layoutEditing.value = { collection, id };
		layoutDraft.value = cloneDeep(existing);
	}

	function closeLayoutEditor() {
		layoutEditing.value = null;
		layoutDraft.value = null;
	}

	function onLayoutDrawerToggle(open: boolean) {
		if (!open) closeLayoutEditor();
	}

	function saveLayoutDraft() {
		if (!layoutEditing.value || !layoutDraft.value) return;

		const { collection, id } = layoutEditing.value;
		const next: CollectionFieldLayout = {
			id,
			roles: [...(layoutDraft.value.roles || [])],
			policies: [...(layoutDraft.value.policies || [])],
			fields: (layoutDraft.value.fields || []).map((entry) => ({
				field: entry.field,
				show: entry.show !== false,
				width: (entry.width || 'full') as FieldWidth,
			})),
		};

		const list = [...(config.value.collections[collection] || [])];
		const index = list.findIndex((layout) => layout.id === id);
		if (index === -1) list.push(next);
		else list[index] = next;

		config.value = {
			...config.value,
			version: 1,
			collections: {
				...config.value.collections,
				[collection]: list,
			},
		};

		closeLayoutEditor();
	}

	function setDraftFieldShow(field: string, show: boolean) {
		if (!layoutDraft.value) return;
		layoutDraft.value = {
			...layoutDraft.value,
			fields: layoutDraft.value.fields.map((entry) =>
				entry.field === field ? { ...entry, show: Boolean(show) } : entry,
			),
		};
	}

	function setDraftFieldWidth(field: string, width: FieldWidth) {
		if (!layoutDraft.value) return;
		if (field === FILE_PREVIEW_FIELD) return;
		layoutDraft.value = {
			...layoutDraft.value,
			fields: layoutDraft.value.fields.map((entry) =>
				entry.field === field ? { ...entry, width } : entry,
			),
		};
	}

	function resetDraftFieldsToDefaults() {
		if (!layoutEditing.value || !layoutDraft.value) return;
		const defaults = createDefaultLayout(layoutEditing.value.collection);
		layoutDraft.value = {
			...layoutDraft.value,
			fields: defaults.fields.map((entry) => ({ ...entry })),
		};
	}

	async function loadRolesAndPolicies() {
		const rolesRes = await api.get('/roles', { params: { limit: -1, fields: ['id', 'name'], sort: 'name' } });

		roleOptions.value = (rolesRes.data?.data || []).map((role: any) => ({
			text: resolveTranslatedLabel(role.name, t),
			value: role.id,
		}));

		try {
			const policiesRes = await api.get('/policies', {
				params: { limit: -1, fields: ['id', 'name'], sort: 'name' },
			});
			policyOptions.value = (policiesRes.data?.data || []).map((policy: any) => ({
				text: resolveTranslatedLabel(policy.name, t),
				value: policy.id,
			}));
		} catch {
			policyOptions.value = [];
		}
	}

	async function load() {
		loading.value = true;

		try {
			await settingsStore.hydrate?.();
		} catch {
			// ignore
		}

		try {
			const response = await api.get('/settings', {
				params: {
					fields: [SYSTEM_FIELDS_FIELD],
				},
			});

			const data = response.data?.data;
			const row = Array.isArray(data) ? data[0] : data;
			const next = serializeConfig(normalizeConfig(row?.[SYSTEM_FIELDS_FIELD]));

			config.value = next;
			initialConfig.value = cloneDeep(next);

			await loadRolesAndPolicies();
		} finally {
			loading.value = false;
		}
	}

	function ensureLoaded() {
		if (!loadPromise) {
			loadPromise = load().finally(() => {
				/* keep promise resolved for subsequent mounts */
			});
		}
		return loadPromise;
	}

	async function save() {
		if (!hasEdits.value) return;
		if (!userHasAdminAccess(userStore.currentUser)) return;

		saving.value = true;

		try {
			const payload = {
				[SYSTEM_FIELDS_FIELD]: serializeConfig(config.value),
			};

			await api.patch('/settings', payload);

			try {
				await settingsStore.hydrate?.();
			} catch {
				// ignore
			}

			initialConfig.value = cloneDeep(serializeConfig(config.value));
			config.value = cloneDeep(initialConfig.value);
		} finally {
			saving.value = false;
		}
	}

	async function cleanupExtensionData(): Promise<{ clearedValue: boolean; deletedField: boolean }> {
		if (!userHasAdminAccess(userStore.currentUser)) {
			throw new Error('Admin access required');
		}

		cleaning.value = true;
		let clearedValue = false;
		let deletedField = false;

		try {
			try {
				await api.patch('/settings', {
					[SYSTEM_FIELDS_FIELD]: null,
				});
				clearedValue = true;
			} catch (error: any) {
				const status = error?.response?.status;
				const message = String(error?.response?.data?.errors?.[0]?.message || error?.message || '');
				if (status !== 400 && status !== 403 && !/unknown|does not exist|forbidden/i.test(message)) {
					throw error;
				}
			}

			try {
				await api.delete(`/fields/directus_settings/${SYSTEM_FIELDS_FIELD}`);
				deletedField = true;
			} catch (error: any) {
				const status = error?.response?.status;
				if (status !== 404) {
					throw error;
				}
				deletedField = true;
			}

			config.value = cloneDeep(EMPTY_SYSTEM_FIELDS);
			initialConfig.value = cloneDeep(EMPTY_SYSTEM_FIELDS);
			closeLayoutEditor();
			loadPromise = null;

			try {
				await settingsStore.hydrate?.();
			} catch {
				// ignore
			}

			return { clearedValue, deletedField };
		} finally {
			cleaning.value = false;
		}
	}

	function exportConfig() {
		const payload = {
			...serializeConfig(config.value),
			exported_at: new Date().toISOString(),
			extension: 'directus-extension-manage-system-fields',
		};

		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
		anchor.href = url;
		anchor.download = `system-fields-${stamp}.json`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	async function importConfig(raw: unknown) {
		if (!userHasAdminAccess(userStore.currentUser)) {
			throw new Error('Admin access required');
		}

		if (!raw || typeof raw !== 'object') {
			throw new Error('Invalid JSON: expected an object');
		}

		const candidate = raw as Record<string, unknown>;
		const source =
			candidate.system_fields && typeof candidate.system_fields === 'object'
				? candidate.system_fields
				: candidate.collections
					? candidate
					: candidate;

		const next = serializeConfig(source);

		if (!Array.isArray(next.collections.directus_files) || !Array.isArray(next.collections.directus_users)) {
			throw new Error('Invalid config: missing collections.directus_files / directus_users arrays');
		}

		config.value = next;

		await api.patch('/settings', {
			[SYSTEM_FIELDS_FIELD]: next,
		});

		initialConfig.value = cloneDeep(next);

		try {
			await settingsStore.hydrate?.();
		} catch {
			// ignore
		}
	}

	return {
		loading,
		saving,
		cleaning,
		config,
		hasEdits,
		roleOptions,
		policyOptions,
		layoutEditing,
		layoutDraft,
		layoutsFor,
		layoutSummary,
		fieldLabel,
		addLayout,
		removeLayout,
		openLayoutEditor,
		closeLayoutEditor,
		onLayoutDrawerToggle,
		saveLayoutDraft,
		setDraftFieldShow,
		setDraftFieldWidth,
		resetDraftFieldsToDefaults,
		ensureLoaded,
		save,
		cleanupExtensionData,
		exportConfig,
		importConfig,
	};
}

export type { FieldLayoutEntry, FieldWidth, SupportedCollection };
