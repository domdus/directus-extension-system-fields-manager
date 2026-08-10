import { defineHook } from '@directus/extensions-sdk';
import { buildPreviewHints, mergeLayoutWithSchemaFields, normalizeConfig, resolveLayout, schemaFieldFromRaw, type SchemaFieldInfo } from '../shared/evaluate';
import {
	SYSTEM_FIELDS_FIELD,
	type FieldLayoutEntry,
	type SystemFieldsConfig,
	type UserAccessContext,
} from '../shared/types';

type Accountability = {
	admin?: boolean | null;
	user?: string | null;
	role?: string | null;
	roles?: string[] | null;
};

async function resolveUserAccessContext(
	database: any,
	accountability: Accountability | null | undefined,
): Promise<UserAccessContext> {
	const roleIds = new Set<string>();
	const policyIds = new Set<string>();

	if (!accountability?.user && !accountability?.role) {
		return { roleIds: [], policyIds: [] };
	}

	if (accountability.role) {
		roleIds.add(accountability.role);
	}

	if (Array.isArray(accountability.roles)) {
		for (const roleId of accountability.roles) {
			if (roleId) roleIds.add(String(roleId));
		}
	}

	try {
		const hasParent = await database.schema.hasColumn('directus_roles', 'parent');
		if (hasParent) {
			for (const startRole of [...roleIds]) {
				let current: string | null = startRole;

				for (let depth = 0; depth < 25 && current; depth++) {
					const row = await database('directus_roles').select('parent').where({ id: current }).first();
					if (!row?.parent) break;
					const parentId = String(row.parent);
					if (roleIds.has(parentId)) break;
					roleIds.add(parentId);
					current = parentId;
				}
			}
		}
	} catch {
		// ignore
	}

	try {
		const hasAccess = await database.schema.hasTable('directus_access');
		if (hasAccess) {
			const query = database('directus_access').select('policy');

			query.where((qb: any) => {
				let hasClause = false;

				if (accountability.user) {
					qb.where({ user: accountability.user });
					hasClause = true;
				}

				if (roleIds.size > 0) {
					if (hasClause) qb.orWhereIn('role', [...roleIds]);
					else qb.whereIn('role', [...roleIds]);
				}
			});

			const accessRows = await query;

			for (const row of accessRows || []) {
				if (row?.policy) policyIds.add(String(row.policy));
			}
		}
	} catch {
		// ignore
	}

	return {
		roleIds: [...roleIds],
		policyIds: [...policyIds],
	};
}

async function ensureSystemFieldsField(services: any, getSchema: () => Promise<any>, database: any, logger: any) {
	try {
		const hasColumn = await database.schema.hasColumn('directus_settings', SYSTEM_FIELDS_FIELD);

		if (hasColumn) {
			const existingMeta = await database('directus_fields')
				.where({ collection: 'directus_settings', field: SYSTEM_FIELDS_FIELD })
				.first();

			if (existingMeta) return;
		}

		const schema = await getSchema();
		const { FieldsService } = services;
		const fieldsService = new FieldsService({
			schema,
			accountability: { admin: true },
		});

		const existingFields = await fieldsService.readAll('directus_settings');
		const alreadyRegistered = existingFields?.some((field: any) => field.field === SYSTEM_FIELDS_FIELD);

		if (alreadyRegistered && hasColumn) return;

		if (!hasColumn || !alreadyRegistered) {
			await fieldsService.createField('directus_settings', {
				field: SYSTEM_FIELDS_FIELD,
				type: 'json',
				meta: {
					collection: 'directus_settings',
					field: SYSTEM_FIELDS_FIELD,
					special: ['cast-json'],
					interface: 'input-code',
					hidden: true,
					readonly: false,
					width: 'full',
					note: 'Managed by System Fields Manager extension. Do not edit manually.',
				},
				schema: {},
			});

			logger?.info?.(`[system-fields-manager] Created directus_settings.${SYSTEM_FIELDS_FIELD}`);
		}
	} catch (error: any) {
		const message = String(error?.message || error || '');
		if (/already exists|duplicate|SQLITE_ERROR/i.test(message)) {
			logger?.warn?.(`[system-fields-manager] Field ensure skipped: ${message}`);
			return;
		}

		logger?.warn?.(`[system-fields-manager] Could not ensure settings field: ${message}`);
	}
}

function getSettingsRows(payload: unknown): Record<string, any>[] | null {
	if (Array.isArray(payload)) return payload;
	if (payload && typeof payload === 'object' && Array.isArray((payload as any).data)) {
		return (payload as any).data;
	}
	if (payload && typeof payload === 'object' && SYSTEM_FIELDS_FIELD in (payload as any)) {
		return [payload as Record<string, any>];
	}
	if (payload && typeof payload === 'object' && (payload as any).data && typeof (payload as any).data === 'object') {
		return [(payload as any).data];
	}
	return null;
}

async function readCollectionSchemaFields(
	services: any,
	getSchema: () => Promise<any>,
	collection: 'directus_files' | 'directus_users',
): Promise<SchemaFieldInfo[]> {
	try {
		const schema = await getSchema();
		const { FieldsService } = services;
		const fieldsService = new FieldsService({
			schema,
			accountability: { admin: true },
		});
		const rows = await fieldsService.readAll(collection);
		return (Array.isArray(rows) ? rows : [])
			.map((row: unknown) => schemaFieldFromRaw(row))
			.filter((entry: SchemaFieldInfo | null): entry is SchemaFieldInfo => Boolean(entry));
	} catch {
		return [];
	}
}

function appliedLayoutFields(
	collection: 'directus_files' | 'directus_users',
	layout: ReturnType<typeof resolveLayout>,
	schemaFields: SchemaFieldInfo[],
): FieldLayoutEntry[] | null {
	if (!layout) return null;
	return mergeLayoutWithSchemaFields(collection, layout.fields || [], schemaFields);
}

/**
 * Directus FieldsService.readAll does not emit a usable `fields.read` filter with the
 * requesting user's accountability (internal meta reads use a non-authorized ItemsService).
 * Enforcement is therefore: resolve layouts here on settings.read, apply in the Studio client.
 */
export default defineHook(({ filter, init, action }, { services, database, getSchema, logger }) => {
	let fieldReady: Promise<void> | null = null;

	const ensureOnce = () => {
		if (!fieldReady) {
			fieldReady = ensureSystemFieldsField(services, getSchema, database, logger).catch(() => {
				/* errors logged inside ensure */
			});
		}
		return fieldReady;
	};

	init('app.before', async () => {
		await ensureOnce();
	});

	action('server.start', async () => {
		await ensureOnce();
	});

	filter('settings.read', async (payload: unknown, _meta: unknown, context: any) => {
		// Always wait — skipping on a race leaves non-admins without `applied` layouts.
		await ensureOnce();

		const accountability: Accountability | null = context?.accountability ?? null;
		if (accountability?.admin) {
			return payload;
		}

		const rows = getSettingsRows(payload);
		if (!rows?.length) return payload;

		const access = await resolveUserAccessContext(database, accountability);

		// Always resolve from DB — non-admins often lack read permission on the custom field,
		// so the payload value may be missing even when config exists.
		let stored: unknown = null;
		try {
			const dbRow = await database('directus_settings').select(SYSTEM_FIELDS_FIELD).first();
			stored = dbRow?.[SYSTEM_FIELDS_FIELD];
		} catch {
			stored = null;
		}

		const config = normalizeConfig(stored);
		const filesLayout = resolveLayout(config, 'directus_files', access);
		const usersLayout = resolveLayout(config, 'directus_users', access);

		const [filesSchema, usersSchema] = await Promise.all([
			filesLayout ? readCollectionSchemaFields(services, getSchema, 'directus_files') : Promise.resolve([]),
			usersLayout ? readCollectionSchemaFields(services, getSchema, 'directus_users') : Promise.resolve([]),
		]);

		const appliedFiles = appliedLayoutFields('directus_files', filesLayout, filesSchema);
		const appliedUsers = appliedLayoutFields('directus_users', usersLayout, usersSchema);

		for (const row of rows) {
			if (!row || typeof row !== 'object') continue;

			row[SYSTEM_FIELDS_FIELD] = {
				version: 1,
				collections: {
					directus_files: [],
					directus_users: [],
				},
				applied: {
					directus_files: appliedFiles,
					directus_users: appliedUsers,
				},
				preview: buildPreviewHints(
					filesLayout
						? {
								...filesLayout,
								fields: appliedFiles || filesLayout.fields,
							}
						: null,
				),
			} satisfies SystemFieldsConfig;
		}

		return payload;
	});

	filter('settings.update', async (payload: any, _meta: unknown, context: any) => {
		const accountability: Accountability | null = context?.accountability ?? null;
		if (accountability?.admin) {
			return payload;
		}

		if (payload && typeof payload === 'object' && SYSTEM_FIELDS_FIELD in payload) {
			delete payload[SYSTEM_FIELDS_FIELD];
		}

		return payload;
	});
});
