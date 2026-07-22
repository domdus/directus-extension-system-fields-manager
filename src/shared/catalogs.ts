import type { FieldLayoutEntry, SupportedCollection } from './types';
import { FILE_PREVIEW_FIELD } from './types';

/** Default field catalogs used to seed new layouts in the admin UI. */
export const DEFAULT_FIELDS: Record<SupportedCollection, FieldLayoutEntry[]> = {
	directus_files: [
		{ field: FILE_PREVIEW_FIELD, show: true, width: 'full' },
		{ field: 'title', show: true, width: 'full' },
		{ field: 'description', show: true, width: 'full' },
		{ field: 'tags', show: true, width: 'full' },
		{ field: 'location', show: true, width: 'full' },
		{ field: 'storage', show: true, width: 'full' },
		{ field: 'focal_point_divider', show: true, width: 'full' },
		{ field: 'focal_point_x', show: true, width: 'half' },
		{ field: 'focal_point_y', show: true, width: 'half' },
		{ field: 'storage_divider', show: true, width: 'full' },
		{ field: 'filename_disk', show: true, width: 'full' },
		{ field: 'filename_download', show: true, width: 'full' },
	],
	directus_users: [
		{ field: 'first_name', show: true, width: 'half' },
		{ field: 'last_name', show: true, width: 'half' },
		{ field: 'email', show: true, width: 'half' },
		{ field: 'password', show: true, width: 'half' },
		{ field: 'avatar', show: true, width: 'full' },
		{ field: 'location', show: true, width: 'half' },
		{ field: 'title', show: true, width: 'half' },
		{ field: 'description', show: true, width: 'full' },
		{ field: 'tags', show: true, width: 'full' },
		{ field: 'preferences_divider', show: true, width: 'full' },
		{ field: 'language', show: true, width: 'half' },
		{ field: 'text_direction', show: true, width: 'half' },
		/** Directus ≤10: single theme select (replaced by appearance / theme_* in 11+) */
		{ field: 'theme', show: true, width: 'half' },
		{ field: 'tfa_secret', show: true, width: 'half' },
		{ field: 'email_notifications', show: true, width: 'half' },
		{ field: 'theming_divider', show: true, width: 'full' },
		{ field: 'appearance', show: true, width: 'half' },
		{ field: 'theme_light', show: true, width: 'full' },
		{ field: 'theme_light_overrides', show: true, width: 'full' },
		{ field: 'theme_dark', show: true, width: 'full' },
		{ field: 'theme_dark_overrides', show: true, width: 'full' },
		{ field: 'admin_divider', show: true, width: 'full' },
		{ field: 'status', show: true, width: 'half' },
		{ field: 'role', show: true, width: 'half' },
		{ field: 'policies', show: true, width: 'full' },
		{ field: 'token', show: true, width: 'full' },
		{ field: 'id', show: true, width: 'full' },
		{ field: 'last_page', show: true, width: 'half' },
		{ field: 'last_access', show: true, width: 'half' },
		{ field: 'provider', show: true, width: 'half' },
		{ field: 'external_identifier', show: true, width: 'half' },
	],
};

export function fieldLabel(field: string): string {
	if (field === FILE_PREVIEW_FIELD) return 'File Preview';
	return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
