import { DEFAULT_FIELDS } from './catalogs';
import {
	EMPTY_SYSTEM_FIELDS,
	FILE_PREVIEW_FIELD,
	SUPPORTED_COLLECTIONS,
	type CollectionFieldLayout,
	type FieldLayoutEntry,
	type FieldWidth,
	type SupportedCollection,
	type SystemFieldsConfig,
	type UserAccessContext,
} from './types';

function normalizeWidth(raw: unknown): FieldWidth {
	// half-right is Directus's auto-paired right column; treat as half in config
	if (raw === 'half' || raw === 'half-right') return 'half';
	if (raw === 'full' || raw === 'fill') return raw;
	return 'full';
}

function normalizeFieldEntry(raw: unknown): FieldLayoutEntry | null {
	if (!raw || typeof raw !== 'object') return null;
	const item = raw as Partial<FieldLayoutEntry>;
	if (!item.field || typeof item.field !== 'string') return null;
	return {
		field: String(item.field),
		show: item.show !== false,
		width: item.field === FILE_PREVIEW_FIELD ? 'full' : normalizeWidth(item.width),
	};
}

function normalizeLayout(raw: unknown): CollectionFieldLayout | null {
	if (!raw || typeof raw !== 'object') return null;
	const item = raw as Partial<CollectionFieldLayout>;
	if (!item.id) return null;

	const fields = Array.isArray(item.fields)
		? item.fields.map(normalizeFieldEntry).filter((entry): entry is FieldLayoutEntry => Boolean(entry))
		: [];

	return {
		id: String(item.id),
		roles: Array.isArray(item.roles) ? item.roles.map(String) : [],
		policies: Array.isArray(item.policies) ? item.policies.map(String) : [],
		fields,
	};
}

export function normalizeConfig(raw: unknown): SystemFieldsConfig {
	if (!raw || typeof raw !== 'object') {
		return {
			version: 1,
			collections: {
				directus_files: [],
				directus_users: [],
			},
		};
	}

	const candidate = raw as Partial<SystemFieldsConfig>;
	const collectionsRaw = (candidate.collections || {}) as Partial<SystemFieldsConfig['collections']>;

	const files = Array.isArray(collectionsRaw.directus_files)
		? collectionsRaw.directus_files.map(normalizeLayout).filter((entry): entry is CollectionFieldLayout => Boolean(entry))
		: [];

	const users = Array.isArray(collectionsRaw.directus_users)
		? collectionsRaw.directus_users.map(normalizeLayout).filter((entry): entry is CollectionFieldLayout => Boolean(entry))
		: [];

	const preview =
		candidate.preview === null
			? null
			: candidate.preview && typeof candidate.preview === 'object'
				? {
						show: candidate.preview.show !== false,
						sort: typeof candidate.preview.sort === 'number' ? candidate.preview.sort : null,
					}
				: undefined;

	const appliedRaw = candidate.applied;
	const applied =
		appliedRaw && typeof appliedRaw === 'object'
			? {
					directus_files: Array.isArray(appliedRaw.directus_files)
						? appliedRaw.directus_files
								.map(normalizeFieldEntry)
								.filter((entry): entry is FieldLayoutEntry => Boolean(entry))
						: appliedRaw.directus_files === null
							? null
							: null,
					directus_users: Array.isArray(appliedRaw.directus_users)
						? appliedRaw.directus_users
								.map(normalizeFieldEntry)
								.filter((entry): entry is FieldLayoutEntry => Boolean(entry))
						: appliedRaw.directus_users === null
							? null
							: null,
				}
			: undefined;

	return {
		version: 1,
		collections: {
			directus_files: files,
			directus_users: users,
		},
		...(preview !== undefined ? { preview } : {}),
		...(applied !== undefined ? { applied } : {}),
	};
}

/** Persistable config — never write computed fields */
export function serializeConfig(raw: unknown): SystemFieldsConfig {
	const normalized = normalizeConfig(raw);
	return {
		version: 1,
		collections: {
			directus_files: normalized.collections.directus_files,
			directus_users: normalized.collections.directus_users,
		},
	};
}

export function ruleHasTargets(rule: { roles?: string[]; policies?: string[] }): boolean {
	return (rule.roles?.length ?? 0) > 0 || (rule.policies?.length ?? 0) > 0;
}

export function userMatchesRule(
	rule: { roles?: string[]; policies?: string[] },
	context: UserAccessContext,
): boolean {
	if (!ruleHasTargets(rule)) return false;

	const roleSet = new Set(context.roleIds);
	const policySet = new Set(context.policyIds);

	if ((rule.roles || []).some((roleId) => roleSet.has(roleId))) return true;
	if ((rule.policies || []).some((policyId) => policySet.has(policyId))) return true;

	return false;
}

export function isSupportedCollection(name: unknown): name is SupportedCollection {
	return SUPPORTED_COLLECTIONS.includes(name as SupportedCollection);
}

/** First matching layout (specific roles/policies first by list order; empty = catch-all). */
export function resolveLayout(
	config: SystemFieldsConfig | null | undefined,
	collection: SupportedCollection,
	context: UserAccessContext,
): CollectionFieldLayout | null {
	const layouts = normalizeConfig(config).collections[collection] || [];
	if (!layouts.length) return null;

	const specific = layouts.filter((layout) => ruleHasTargets(layout));
	const catchAll = layouts.filter((layout) => !ruleHasTargets(layout));

	for (const layout of specific) {
		if (userMatchesRule(layout, context)) return layout;
	}

	return catchAll[0] || null;
}

export function buildPreviewHints(layout: CollectionFieldLayout | null): SystemFieldsConfig['preview'] {
	if (!layout) return null;

	const previewEntry = layout.fields.find((entry) => entry.field === FILE_PREVIEW_FIELD);
	if (!previewEntry) return null;

	const visible = layout.fields.filter((entry) => entry.show !== false);
	const sort = visible.findIndex((entry) => entry.field === FILE_PREVIEW_FIELD);

	return {
		show: previewEntry.show !== false,
		sort: sort >= 0 ? sort : null,
	};
}

/**
 * Apply a layout to a fields.read payload list for one collection.
 * Virtual `__file_preview__` is skipped (client handles preview chrome).
 */
export function applyFieldLayout(
	fields: any[] | null | undefined,
	layout: CollectionFieldLayout | null,
	collection: SupportedCollection,
): any[] {
	if (!Array.isArray(fields)) return [];
	if (!layout) return fields;

	const configByField = new Map(
		layout.fields
			.filter((entry) => entry.field !== FILE_PREVIEW_FIELD)
			.map((entry, index) => [entry.field, { ...entry, order: index }]),
	);

	const touched = new Set<string>();
	const configured: any[] = [];
	const rest: any[] = [];

	// Preserve configured order
	for (const entry of layout.fields) {
		if (entry.field === FILE_PREVIEW_FIELD) continue;
		const match = fields.find((field) => {
			const name = field?.field || field?.meta?.field;
			const coll = field?.collection || field?.meta?.collection;
			return name === entry.field && (!coll || coll === collection);
		});
		if (!match) continue;

		const next = { ...match };
		next.meta = { ...(match.meta || {}) };
		next.meta.sort = configured.length;
		next.meta.hidden = entry.show === false;
		next.meta.width = entry.width;
		if ('sort' in next) next.sort = configured.length;
		if ('hidden' in next) next.hidden = next.meta.hidden;
		if ('width' in next) next.width = entry.width;

		configured.push(next);
		touched.add(entry.field);
	}

	for (const field of fields) {
		const name = field?.field || field?.meta?.field;
		const coll = field?.collection || field?.meta?.collection;
		if (coll && coll !== collection) {
			rest.push(field);
			continue;
		}
		if (!name || touched.has(String(name))) continue;

		const next = { ...field };
		next.meta = { ...(field.meta || {}) };
		// Unconfigured fields stay after configured ones
		next.meta.sort = 100000 + rest.length;
		if ('sort' in next) next.sort = next.meta.sort;
		rest.push(next);
	}

	return [...configured, ...rest];
}

export function createDefaultLayout(collection: SupportedCollection, id?: string): CollectionFieldLayout {
	return {
		id: id || `${collection}-default`,
		roles: [],
		policies: [],
		fields: DEFAULT_FIELDS[collection].map((entry) => ({ ...entry })),
	};
}

export { EMPTY_SYSTEM_FIELDS };
