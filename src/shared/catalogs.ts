import { FILE_PREVIEW_FIELD } from './types';

/** Pretty-print a field key when Directus does not provide a display name. */
export function fieldLabel(field: string): string {
	if (field === FILE_PREVIEW_FIELD) return 'File Preview';
	return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
