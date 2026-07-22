export const SYSTEM_FIELDS_FIELD = 'system_fields';

export const FILE_PREVIEW_FIELD = '__file_preview__';

export const SUPPORTED_COLLECTIONS = ['directus_files', 'directus_users'] as const;

export type SupportedCollection = (typeof SUPPORTED_COLLECTIONS)[number];

export type FieldWidth = 'half' | 'full' | 'fill';

export type FieldLayoutEntry = {
	field: string;
	show: boolean;
	width: FieldWidth;
};

/** First match wins (list order). Empty roles+policies = catch-all. */
export type CollectionFieldLayout = {
	id: string;
	roles: string[];
	policies: string[];
	fields: FieldLayoutEntry[];
};

/**
 * Computed on settings.read for non-admins — resolved layout for the current user.
 * Never persist. Studio client enforcer applies these (FieldsService does not emit
 * a usable fields.read filter with user accountability).
 */
export type AppliedLayouts = {
	directus_files: FieldLayoutEntry[] | null;
	directus_users: FieldLayoutEntry[] | null;
};

export type SystemFieldsConfig = {
	version: 1;
	collections: {
		directus_files: CollectionFieldLayout[];
		directus_users: CollectionFieldLayout[];
	};
	/** Computed — never persist */
	applied?: AppliedLayouts;
	/**
	 * Computed on settings.read for non-admins — file preview chrome hints.
	 * Never persist.
	 */
	preview?: {
		show: boolean;
		/** Index among configured visible fields; null if preview not in layout */
		sort: number | null;
	} | null;
};

export type UserAccessContext = {
	roleIds: string[];
	policyIds: string[];
};

export const EMPTY_SYSTEM_FIELDS: SystemFieldsConfig = {
	version: 1,
	collections: {
		directus_files: [],
		directus_users: [],
	},
};
