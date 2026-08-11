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
		...(item.name ? { name: String(item.name) } : {}),
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

export function createDefaultLayout(
	collection: SupportedCollection,
	schemaFields: SchemaFieldInfo[] = [],
	id?: string,
): CollectionFieldLayout {
	return {
		id: id || `${collection}-default`,
		roles: [],
		policies: [],
		fields: layoutFieldsFromSchema(collection, schemaFields),
	};
}

/** Live collection field info used to build / merge layouts. */
export type SchemaFieldInfo = {
	field: string;
	width?: FieldWidth | string | null;
	hidden?: boolean | null;
	special?: string[] | null;
	interface?: string | null;
	sort?: number | null;
	/** Parent group field name when nested inside a Directus group */
	group?: string | null;
	/** Display name from Directus field meta / translations */
	name?: string | null;
};

/** Fields that exist in schema but are never part of the Studio item form. */
const SKIP_SCHEMA_FIELDS = new Set(['auth_data']);

/** Alias/no-data fields that still appear as form chrome (groups, dividers, notices). */
export function isFormChromeField(info: Pick<SchemaFieldInfo, 'interface' | 'special'> | null | undefined): boolean {
	if (!info) return false;
	const special = Array.isArray(info.special) ? info.special.map(String) : [];
	const iface = String(info.interface || '');

	if (special.includes('group')) return true;
	if (iface.startsWith('group')) return true;
	if (iface.startsWith('presentation-')) return true;

	return false;
}

export function isGroupField(info: Pick<SchemaFieldInfo, 'interface' | 'special'> | null | undefined): boolean {
	if (!info) return false;
	const special = Array.isArray(info.special) ? info.special.map(String) : [];
	const iface = String(info.interface || '');
	return special.includes('group') || iface.startsWith('group');
}

export type LayoutTreeNode = {
	entry: FieldLayoutEntry;
	children?: LayoutTreeNode[];
};

/**
 * Nest Directus group children under their parent for Data-Model-style drag UI.
 * Flat order is preserved: group, then its children, then the next root field.
 */
export function buildLayoutTree(
	fields: FieldLayoutEntry[],
	schemaFields: SchemaFieldInfo[],
): LayoutTreeNode[] {
	const byName = new Map(schemaFields.map((info) => [info.field, info]));
	const groupNames = new Set(
		schemaFields.filter((info) => isGroupField(info)).map((info) => info.field),
	);

	const childrenByGroup = new Map<string, FieldLayoutEntry[]>();
	const roots: FieldLayoutEntry[] = [];

	for (const entry of fields || []) {
		const info = byName.get(entry.field);
		const parent = info?.group || null;

		if (parent && groupNames.has(parent)) {
			if (!childrenByGroup.has(parent)) childrenByGroup.set(parent, []);
			childrenByGroup.get(parent)!.push(entry);
			continue;
		}

		roots.push(entry);
	}

	return roots.map((entry) => {
		if (!groupNames.has(entry.field)) {
			return { entry };
		}

		return {
			entry,
			children: (childrenByGroup.get(entry.field) || []).map((child) => ({ entry: child })),
		};
	});
}

export function flattenLayoutTree(tree: LayoutTreeNode[]): FieldLayoutEntry[] {
	const result: FieldLayoutEntry[] = [];

	for (const node of tree || []) {
		if (!node?.entry?.field) continue;
		result.push({ ...node.entry });
		for (const child of node.children || []) {
			if (!child?.entry?.field) continue;
			result.push({ ...child.entry });
		}
	}

	return result;
}

export function interfaceLabel(info: SchemaFieldInfo | null | undefined): string {
	if (!info) return '';
	const iface = String(info.interface || '');
	if (!iface) return '';
	if (iface === 'presentation-divider') return 'Divider';
	if (iface === 'group-detail') return 'Detail Group';
	if (iface === 'group-raw') return 'Raw Group';
	if (iface === 'group-tabs') return 'Tab Group';
	if (iface.startsWith('group')) return 'Group';
	if (iface === 'input') return 'Input';
	if (iface === 'input-multiline') return 'Textarea';
	if (iface === 'input-hash') return 'Hash';
	if (iface === 'select-dropdown') return 'Dropdown';
	if (iface === 'select-dropdown-m2o') return 'Many to One';
	if (iface === 'list-m2m') return 'Many to Many';
	if (iface === 'boolean') return 'Toggle';
	if (iface === 'tags') return 'Tags';
	if (iface === 'file' || iface === 'file-image') return 'File';
	if (iface === 'system-language') return 'Language';
	if (iface === 'system-theme') return 'Theme';
	if (iface === 'system-theme-overrides') return 'Theme Overrides';
	if (iface === 'system-token') return 'Token';
	if (iface === 'system-mfa-setup') return 'mfa-setup';
	return iface
		.replace(/^input-/, '')
		.replace(/^system-/, '')
		.replace(/-/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isManageableSchemaField(info: SchemaFieldInfo): boolean {
	const name = String(info.field || '').trim();
	if (!name || name === FILE_PREVIEW_FIELD) return false;
	if (SKIP_SCHEMA_FIELDS.has(name)) return false;

	const special = Array.isArray(info.special) ? info.special.map(String) : [];

	// `no-data` covers both junk aliases and real form chrome (groups / dividers).
	if (special.includes('no-data') && !isFormChromeField(info)) return false;

	return true;
}

export function schemaFieldFromRaw(raw: unknown): SchemaFieldInfo | null {
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, any>;
	const field = String(row.field || row.meta?.field || '').trim();
	if (!field) return null;

	const meta = row.meta && typeof row.meta === 'object' ? row.meta : row;
	const special = Array.isArray(meta?.special)
		? meta.special.map(String)
		: Array.isArray(row.special)
			? row.special.map(String)
			: null;

	let name: string | null = null;
	if (typeof meta?.name === 'string' && meta.name.trim()) name = meta.name.trim();
	else if (Array.isArray(meta?.translations)) {
		const en = meta.translations.find(
			(t: any) => t?.language === 'en-US' || t?.language === 'en-GB' || t?.language === 'en',
		);
		const pick = en || meta.translations[0];
		if (typeof pick?.translation === 'string' && pick.translation.trim()) {
			name = pick.translation.trim();
		}
	}

	const group =
		typeof meta?.group === 'string' && meta.group.trim()
			? meta.group.trim()
			: typeof row.group === 'string' && row.group.trim()
				? row.group.trim()
				: null;

	return {
		field,
		width: meta?.width ?? row.width ?? null,
		hidden: meta?.hidden ?? row.hidden ?? null,
		special,
		interface: meta?.interface ?? row.interface ?? null,
		sort: typeof meta?.sort === 'number' ? meta.sort : typeof row.sort === 'number' ? row.sort : null,
		group,
		name,
	};
}

function entryFromSchema(info: SchemaFieldInfo): FieldLayoutEntry {
	return {
		field: info.field,
		show: info.hidden !== true,
		width: normalizeWidth(info.width),
	};
}

/** Build a fresh field list from live schema (+ virtual File Preview on Files). */
export function layoutFieldsFromSchema(
	collection: SupportedCollection,
	schemaFields: SchemaFieldInfo[],
): FieldLayoutEntry[] {
	const sorted = [...(schemaFields || [])]
		.filter(isManageableSchemaField)
		.sort((a, b) => {
			const as = a.sort == null ? Number.POSITIVE_INFINITY : a.sort;
			const bs = b.sort == null ? Number.POSITIVE_INFINITY : b.sort;
			if (as !== bs) return as - bs;
			return a.field.localeCompare(b.field);
		});

	const fields = sorted.map(entryFromSchema);

	if (collection === 'directus_files') {
		fields.unshift({ field: FILE_PREVIEW_FIELD, show: true, width: 'full' });
	}

	return fields;
}

/**
 * Keep existing layout entries (order + settings), drop fields removed from schema,
 * append any new schema fields, and ensure File Preview exists on Files layouts.
 */
export function mergeLayoutWithSchemaFields(
	collection: SupportedCollection,
	existing: FieldLayoutEntry[],
	schemaFields: SchemaFieldInfo[],
): FieldLayoutEntry[] {
	const manageable = (schemaFields || []).filter(isManageableSchemaField);
	const schemaNames = new Set(manageable.map((info) => info.field));
	const pruneUnknown = schemaNames.size > 0;

	const seen = new Set<string>();
	const result: FieldLayoutEntry[] = [];

	for (const entry of existing || []) {
		const field = String(entry?.field || '').trim();
		if (!field || seen.has(field)) continue;

		if (field === FILE_PREVIEW_FIELD) {
			if (collection !== 'directus_files') continue;
			seen.add(field);
			result.push({ field, show: entry.show !== false, width: 'full' });
			continue;
		}

		if (pruneUnknown && !schemaNames.has(field)) continue;

		seen.add(field);
		result.push({
			field,
			show: entry.show !== false,
			width: normalizeWidth(entry.width),
		});
	}

	for (const info of manageable) {
		if (seen.has(info.field)) continue;
		seen.add(info.field);
		result.push(entryFromSchema(info));
	}

	if (collection === 'directus_files' && !seen.has(FILE_PREVIEW_FIELD)) {
		result.unshift({ field: FILE_PREVIEW_FIELD, show: true, width: 'full' });
	}

	return result;
}

export function createDefaultLayoutWithSchema(
	collection: SupportedCollection,
	schemaFields: SchemaFieldInfo[],
	id?: string,
): CollectionFieldLayout {
	return createDefaultLayout(collection, schemaFields, id);
}

export { EMPTY_SYSTEM_FIELDS };
