import { normalizeConfig } from '../shared/evaluate';
import { userHasAdminAccess } from '../shared/admin';
import { fieldLabel } from '../shared/catalogs';
import {
	FILE_PREVIEW_FIELD,
	SYSTEM_FIELDS_FIELD,
	type FieldLayoutEntry,
	type FieldWidth,
	type SupportedCollection,
	type SystemFieldsConfig,
} from '../shared/types';

/**
 * Studio layout enforcer — scope contract
 * ---------------------------------------
 * ONLY mutates DOM when ALL are true:
 *   1. current user is NOT an admin
 *   2. route is /users/:id or /files/...
 *   3. the form belongs to directus_users / directus_files
 *
 * Ownership marks:
 *   - form[data-sf-enforced="<collection>"] — only this form is styled/cleared
 *   - [data-sf-key] — our field identity (never overwrite Directus data-field)
 *   - [data-sf-order] / [data-sf-width] / [data-sf-field-hidden] — layout only
 *
 * Never adds/removes Directus half/full/fill classes. Width is attr + CSS only.
 */

const ENFORCER_FLAG = '__systemFieldsLayoutEnforcerV22';
const STYLE_ID = 'sf-layout-enforcer-styles-v22';
const LEGACY_STYLE_IDS = [
	'sf-layout-enforcer-styles',
	'sf-layout-enforcer-styles-v4',
	'sf-layout-enforcer-styles-v5',
	'sf-layout-enforcer-styles-v6',
	'sf-layout-enforcer-styles-v7',
	'sf-layout-enforcer-styles-v8',
	'sf-layout-enforcer-styles-v9',
	'sf-layout-enforcer-styles-v10',
	'sf-layout-enforcer-styles-v11',
	'sf-layout-enforcer-styles-v12',
	'sf-layout-enforcer-styles-v13',
	'sf-layout-enforcer-styles-v14',
	'sf-layout-enforcer-styles-v15',
	'sf-layout-enforcer-styles-v16',
	'sf-layout-enforcer-styles-v17',
	'sf-layout-enforcer-styles-v18',
	'sf-layout-enforcer-styles-v19',
	'sf-layout-enforcer-styles-v20',
	'sf-layout-enforcer-styles-v21',
];
const LEGACY_FLAGS = [
	'__systemFieldsLayoutEnforcerInstalled',
	'__systemFieldsLayoutEnforcerV4',
	'__systemFieldsLayoutEnforcerV5',
	'__systemFieldsLayoutEnforcerV6',
	'__systemFieldsLayoutEnforcerV7',
	'__systemFieldsLayoutEnforcerV8',
	'__systemFieldsLayoutEnforcerV9',
	'__systemFieldsLayoutEnforcerV10',
	'__systemFieldsLayoutEnforcerV11',
	'__systemFieldsLayoutEnforcerV12',
	'__systemFieldsLayoutEnforcerV13',
	'__systemFieldsLayoutEnforcerV14',
	'__systemFieldsLayoutEnforcerV15',
	'__systemFieldsLayoutEnforcerV16',
	'__systemFieldsLayoutEnforcerV17',
	'__systemFieldsLayoutEnforcerV18',
	'__systemFieldsLayoutEnforcerV19',
	'__systemFieldsLayoutEnforcerV20',
	'__systemFieldsLayoutEnforcerV21',
];

const HIDDEN_CLASS = 'sf-file-preview-hidden';
const REFLOW_CLASS = 'sf-reflow';
const FORM_MARK = 'data-sf-enforced';
const KEY_ATTR = 'data-sf-key';
const FIELD_HIDDEN_ATTR = 'data-sf-field-hidden';
const ORDER_ATTR = 'data-sf-order';
const WIDTH_ATTR = 'data-sf-width';
const INJECTED_DIVIDER_ATTR = 'data-sf-injected-divider';

const DIVIDER_TITLES: Record<string, string> = {
	preferences_divider: 'User Preferences',
	admin_divider: 'Admin Options',
	theming_divider: 'Theming',
	focal_point_divider: 'Focal Point',
	storage_divider: 'Storage Details',
};

const FIELD_LABEL_ALIASES: Record<string, string> = {
	Password: 'password',
	'Two-Factor Authentication': 'tfa_secret',
	'User Preferences': 'preferences_divider',
	'Admin Options': 'admin_divider',
	Theming: 'theming_divider',
	'Storage Details': 'storage_divider',
	'Focal Point': 'focal_point_divider',
};

/** Top-level nodes on an owned users/files form (not group-raw — that is Studio chrome elsewhere). */
const TOP_LEVEL_FIELD_SELECTOR = [
	':scope > .field',
	':scope > div.field',
	':scope > .group-detail',
	':scope > .v-detail.group-detail',
	':scope > .group-accordion',
	':scope > .v-item-group.group-accordion',
].join(', ');

type LooseStore = {
	currentUser?: {
		admin_access?: boolean;
		role?: unknown;
	} | null;
	settings?: {
		[SYSTEM_FIELDS_FIELD]?: SystemFieldsConfig | null;
	} | null;
};

type FieldMetaInfo = {
	interface?: string | null;
	group?: string | null;
	special?: string[] | null;
};

type FieldMetaMap = Map<string, FieldMetaInfo>;
type DisplayWidth = FieldWidth | 'half-right';

function getPinia(app: any): any {
	return app?.config?.globalProperties?.$pinia || null;
}

function getStoreState(pinia: any, id: string): LooseStore | null {
	try {
		const store = pinia?._s?.get?.(id);
		return (store || null) as LooseStore | null;
	} catch {
		return null;
	}
}

function isAdminUser(pinia: any): boolean {
	const userStore = getStoreState(pinia, 'userStore');
	return userHasAdminAccess(userStore?.currentUser);
}

function getConfig(pinia: any): SystemFieldsConfig {
	const settingsStore = getStoreState(pinia, 'settingsStore');
	return normalizeConfig(settingsStore?.settings?.[SYSTEM_FIELDS_FIELD]);
}

/** Strict route gate — never content collections, settings, roles, etc. */
function detectCollectionRoute(path: string): SupportedCollection | null {
	const parts = path.split('/').filter(Boolean);
	// Strip optional admin base if present in some embeds.
	const start = parts[0] === 'admin' ? 1 : 0;
	const root = parts[start];
	const rest = parts.slice(start + 1);

	if (root === 'files') {
		if (rest.length === 1 && rest[0] !== 'folders') return 'directus_files';
		if (rest.length === 3 && rest[0] === 'folders') return 'directus_files';
		return null;
	}
	if (root === 'users') {
		// /users/:id — not /users, /users/roles, /users/roles/:role
		if (rest.length === 1 && rest[0] !== 'roles') return 'directus_users';
		return null;
	}
	return null;
}

function getRoutePath(router: any): string {
	const fromRouter = router?.currentRoute?.value?.path ?? router?.currentRoute?.path;
	if (typeof fromRouter === 'string' && fromRouter.length) return fromRouter;

	const hash = typeof window !== 'undefined' ? window.location.hash : '';
	if (hash.startsWith('#/')) return hash.slice(1);

	return typeof window !== 'undefined' ? window.location.pathname || '' : '';
}

function ensureStyleEl(): HTMLStyleElement {
	for (const id of LEGACY_STYLE_IDS) {
		document.getElementById(id)?.remove();
	}

	let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!el) {
		el = document.createElement('style');
		el.id = STYLE_ID;
		document.head.appendChild(el);
	}

	// CSS ONLY applies under owned marks — zero effect on other Studio forms.
	el.textContent = `
html.${HIDDEN_CLASS} .file-item > .preview,
html.${HIDDEN_CLASS} .file-item > .file-preview-replace {
	display: none !important;
}

.v-form[${FORM_MARK}] [${FIELD_HIDDEN_ATTR}="true"] {
	display: none !important;
}

.v-form[${FORM_MARK}].grid [${INJECTED_DIVIDER_ATTR}],
.v-form[${FORM_MARK}].grid [${WIDTH_ATTR}="full"] {
	grid-column: start / full !important;
	min-inline-size: 0;
}
.v-form[${FORM_MARK}].grid [${WIDTH_ATTR}="half"] {
	grid-column: start / half !important;
	min-inline-size: 0;
}
.v-form[${FORM_MARK}].grid [${WIDTH_ATTR}="half-right"] {
	grid-column: half / full !important;
	min-inline-size: 0;
}
.v-form[${FORM_MARK}].grid [${WIDTH_ATTR}="fill"] {
	grid-column: start / fill !important;
	min-inline-size: 0;
}
.v-form[${FORM_MARK}] [${ORDER_ATTR}] {
	order: var(--sf-order, 0);
}
@container (inline-size < 31.25rem) {
	.v-form[${FORM_MARK}].grid [${WIDTH_ATTR}="half"],
	.v-form[${FORM_MARK}].grid [${WIDTH_ATTR}="half-right"] {
		grid-column: start / full !important;
	}
}

.file-item.${REFLOW_CLASS} {
	display: grid !important;
	grid-template-columns:
		[start] minmax(0, var(--form-column-max-width)) [half] minmax(0, var(--form-column-max-width))
		[full] minmax(0, 1fr) [fill] !important;
	gap:
		var(--theme--form--row-gap, var(--form-vertical-gap, 40px))
		var(--theme--form--column-gap, var(--form-horizontal-gap, 32px)) !important;
	container-type: inline-size;
}
.file-item.${REFLOW_CLASS} > .v-form,
.file-item.${REFLOW_CLASS} > .v-form.grid {
	display: contents !important;
}
.file-item.${REFLOW_CLASS} > .preview,
.file-item.${REFLOW_CLASS} > .file-preview-replace {
	order: var(--sf-order, 0);
	min-inline-size: 0;
	grid-column: start / full !important;
}
.file-item.${REFLOW_CLASS} .field[${ORDER_ATTR}],
.file-item.${REFLOW_CLASS} .group-detail[${ORDER_ATTR}],
.file-item.${REFLOW_CLASS} .group-accordion[${ORDER_ATTR}],
.file-item.${REFLOW_CLASS} .v-item-group[${ORDER_ATTR}] {
	order: var(--sf-order, 1000);
}
.file-item.${REFLOW_CLASS} [${WIDTH_ATTR}="full"] {
	grid-column: start / full !important;
}
.file-item.${REFLOW_CLASS} [${WIDTH_ATTR}="fill"] {
	grid-column: start / fill !important;
}
.file-item.${REFLOW_CLASS} [${WIDTH_ATTR}="fill"] .file-preview {
	max-inline-size: none;
}
.file-item.${REFLOW_CLASS} [${WIDTH_ATTR}="half"] {
	grid-column: start / half !important;
}
.file-item.${REFLOW_CLASS} [${WIDTH_ATTR}="half-right"] {
	grid-column: half / full !important;
}
@container (inline-size < 31.25rem) {
	.file-item.${REFLOW_CLASS} [${WIDTH_ATTR}="half"],
	.file-item.${REFLOW_CLASS} [${WIDTH_ATTR}="half-right"] {
		grid-column: start / full !important;
	}
}
.file-item.${REFLOW_CLASS} > :not(.preview):not(.file-preview-replace):not(.v-form) {
	order: 5000;
	grid-column: start / full !important;
}
`;
	return el;
}

function findFileItem(): HTMLElement | null {
	return document.querySelector('.file-item');
}

function formBelongsToCollection(form: HTMLElement, collection: SupportedCollection): boolean {
	if (form.getAttribute(FORM_MARK) === collection) return true;
	// Studio often stamps collection on nested inputs (not data-collection on the field wrapper).
	if (form.querySelector(`[data-collection="${collection}"]`)) return true;
	if (form.querySelector(`[collection="${collection}"]`)) return true;
	if (collection === 'directus_files' && form.closest('.file-item')) return true;
	return false;
}

function formFieldCount(form: HTMLElement): number {
	return form.querySelectorAll(
		':scope > .field, :scope > .group-detail, :scope > .group-accordion, :scope > .v-item-group.group-accordion',
	).length;
}

/**
 * Find the users/files item form. Files can key off `.file-item` immediately.
 * Users often mount `.v-form` before Vue writes `collection=` attrs — so on a
 * gated /users/:id route, fall back to the largest main-content form.
 */
function findFormRoot(collection: SupportedCollection): HTMLElement | null {
	const marked = document.querySelector(`.v-form[${FORM_MARK}="${collection}"]`) as HTMLElement | null;
	if (marked) return marked;

	if (collection === 'directus_files') {
		const nested = document.querySelector('.file-item .v-form') as HTMLElement | null;
		if (nested) return nested;
	}

	const scopes = [
		document.querySelector('#main-content'),
		document.querySelector('.private-view'),
		document.body,
	].filter(Boolean) as HTMLElement[];

	const seen = new Set<HTMLElement>();
	const candidates: HTMLElement[] = [];
	for (const scope of scopes) {
		for (const node of Array.from(scope.querySelectorAll('.v-form')) as HTMLElement[]) {
			if (seen.has(node)) continue;
			if (node.closest('#sidebar, #navigation')) continue;
			seen.add(node);
			candidates.push(node);
		}
	}

	for (const form of candidates) {
		if (formBelongsToCollection(form, collection)) return form;
	}

	// Route already gated to users item — pick the densest content form.
	if (collection === 'directus_users') {
		let best: HTMLElement | null = null;
		let bestCount = 0;
		for (const form of candidates) {
			const count = formFieldCount(form);
			if (count > bestCount) {
				bestCount = count;
				best = form;
			}
		}
		if (best && bestCount > 0) return best;
	}

	return null;
}

function markForm(form: HTMLElement, collection: SupportedCollection) {
	form.setAttribute(FORM_MARK, collection);
}

function isGroupWrapper(el: HTMLElement): boolean {
	return (
		el.classList.contains('group-detail') ||
		el.classList.contains('group-accordion') ||
		(el.classList.contains('v-item-group') && el.classList.contains('group-accordion')) ||
		(el.classList.contains('v-detail') && el.classList.contains('group-detail'))
	);
}

function slugifyLabel(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

function findTopLevelNodes(form: HTMLElement): HTMLElement[] {
	const seen = new Set<HTMLElement>();
	const out: HTMLElement[] = [];
	for (const node of Array.from(form.querySelectorAll(TOP_LEVEL_FIELD_SELECTOR)) as HTMLElement[]) {
		if (seen.has(node)) continue;
		seen.add(node);
		out.push(node);
	}
	return out;
}

function isNestedUnderFormField(node: HTMLElement, form: HTMLElement): boolean {
	let parent = node.parentElement;
	while (parent && parent !== form) {
		if (
			parent.classList.contains('field') ||
			parent.classList.contains('group-detail') ||
			parent.classList.contains('group-accordion') ||
			parent.classList.contains('v-item-group')
		) {
			return true;
		}
		parent = parent.parentElement;
	}
	return false;
}

function isGroupMeta(meta: FieldMetaInfo | undefined | null): boolean {
	if (!meta) return false;
	const iface = String(meta.interface || '');
	if (iface.startsWith('group')) return true;
	if (Array.isArray(meta.special) && meta.special.map(String).includes('group')) return true;
	return false;
}

function getCollectionFieldMeta(pinia: any, collection: string): FieldMetaMap {
	const out: FieldMetaMap = new Map();
	try {
		const store = pinia?._s?.get?.('fieldsStore');
		if (!store) return out;

		let rows: any[] = [];
		if (typeof store.getFieldsForCollection === 'function') {
			rows = store.getFieldsForCollection(collection) || [];
		} else if (Array.isArray(store.fields)) {
			rows = store.fields.filter((row: any) => row?.collection === collection);
		} else if (store.fields && typeof store.fields === 'object') {
			const keyed = store.fields[collection];
			rows = Array.isArray(keyed) ? keyed : [];
		}

		for (const row of rows) {
			const name = typeof row?.field === 'string' ? row.field : null;
			if (!name) continue;
			const meta = row.meta && typeof row.meta === 'object' ? row.meta : row;
			out.set(name, {
				interface: meta?.interface ?? null,
				group: typeof meta?.group === 'string' ? meta.group : null,
				special: Array.isArray(meta?.special) ? meta.special.map(String) : null,
			});
		}
	} catch {
		/* ignore */
	}
	return out;
}

function stampKey(el: HTMLElement, name: string) {
	el.setAttribute(KEY_ATTR, name);
}

function fieldKeyFromUnknown(value: unknown): string | null {
	if (typeof value === 'string' && value && value !== 'true' && value !== 'false') return value;
	if (value && typeof value === 'object' && typeof (value as { field?: unknown }).field === 'string') {
		return (value as { field: string }).field;
	}
	return null;
}

function isGroupFieldObject(value: unknown): boolean {
	if (!value || typeof value !== 'object') return false;
	const obj = value as {
		meta?: { interface?: unknown; special?: unknown };
		interface?: unknown;
		special?: unknown;
		type?: unknown;
	};
	const iface = String(obj.meta?.interface ?? obj.interface ?? '');
	if (iface.startsWith('group')) return true;
	const special = obj.meta?.special ?? obj.special;
	if (Array.isArray(special) && special.map(String).includes('group')) return true;
	return false;
}

function fieldNameFromGroupVue(el: HTMLElement): string | null {
	const roots = [
		el,
		el.querySelector(':scope > .toggle-btn'),
		el.querySelector(':scope > button'),
		el.querySelector(':scope .title'),
	].filter(Boolean) as HTMLElement[];

	for (const root of roots) {
		const vue2 = (root as any).__vue__;
		if (vue2) {
			for (const candidate of [vue2.field, vue2.$props?.field, vue2.$attrs?.field]) {
				if (isGroupFieldObject(candidate)) {
					const key = fieldKeyFromUnknown(candidate);
					if (key) return key;
				}
			}
		}

		let vnode = (root as any).__vueParentComponent;
		let fallback: string | null = null;
		for (let depth = 0; depth < 12 && vnode; depth++) {
			const propField = vnode.props?.field;
			if (isGroupFieldObject(propField)) {
				const key = fieldKeyFromUnknown(propField);
				if (key) return key;
			}
			const fromProps = fieldKeyFromUnknown(propField);
			if (fromProps && !fallback) fallback = fromProps;
			vnode = vnode.parent;
		}
		if (fallback) return fallback;
	}
	return null;
}

function fieldNameFromVue(el: HTMLElement): string | null {
	const roots = [
		el,
		el.firstElementChild,
		el.querySelector('.interface'),
		el.querySelector('input,textarea,button'),
	].filter(Boolean) as HTMLElement[];

	for (const root of roots) {
		const vue2 = (root as any).__vue__;
		if (vue2) {
			const fromVue2 =
				fieldKeyFromUnknown(vue2.field) ||
				fieldKeyFromUnknown(vue2.$props?.field) ||
				fieldKeyFromUnknown(vue2.$attrs?.field);
			if (fromVue2) return fromVue2;
		}

		let vnode = (root as any).__vueParentComponent;
		for (let depth = 0; depth < 18 && vnode; depth++) {
			const fromProps = fieldKeyFromUnknown(vnode.props?.field);
			if (fromProps) return fromProps;
			vnode = vnode.parent;
		}
	}
	return null;
}

function groupTitleText(el: HTMLElement): string | null {
	if (el.classList.contains('group-accordion') || el.classList.contains('v-item-group')) return null;
	const labelEl =
		(el.querySelector(':scope > .toggle-btn .title') as HTMLElement | null) ||
		(el.querySelector(':scope > button.toggle-btn .title') as HTMLElement | null);
	return labelEl?.textContent?.trim() || null;
}

function matchLayoutKey(candidate: string, layoutKeys?: Set<string>): string | null {
	if (!layoutKeys?.size) return null;
	if (layoutKeys.has(candidate)) return candidate;
	const slug = slugifyLabel(candidate);
	if (layoutKeys.has(slug)) return slug;
	for (const key of layoutKeys) {
		if (slugifyLabel(key) === slug) return key;
		if (slugifyLabel(fieldLabel(key)) === slug) return key;
	}
	return null;
}

function fieldNameFromLabel(el: HTMLElement, layoutKeys?: Set<string>): string | null {
	const labelEl =
		(el.querySelector('.field-label .v-text-overflow') as HTMLElement | null) ||
		(el.querySelector('.field-name .v-text-overflow') as HTMLElement | null) ||
		(el.querySelector('.v-divider .type-text') as HTMLElement | null);
	const text = labelEl?.textContent?.trim();
	if (!text) return null;
	if (FIELD_LABEL_ALIASES[text]) return FIELD_LABEL_ALIASES[text];
	return matchLayoutKey(text, layoutKeys) || slugifyLabel(text) || null;
}

function fieldNameFromGroupChildren(el: HTMLElement, fieldMeta: FieldMetaMap): string | null {
	const votes = new Map<string, number>();
	const bump = (child: string | null | undefined) => {
		if (!child) return;
		const parent = fieldMeta.get(child)?.group;
		if (!parent) return;
		votes.set(parent, (votes.get(parent) || 0) + 1);
	};

	for (const nested of Array.from(el.querySelectorAll(`.field[${KEY_ATTR}], .field[data-field]`)) as HTMLElement[]) {
		if (nested === el) continue;
		bump(nested.getAttribute(KEY_ATTR) || nested.getAttribute('data-field'));
	}

	for (const label of Array.from(
		el.querySelectorAll('.accordion-section .field-name, .v-item.accordion-section .field-name'),
	) as HTMLElement[]) {
		const text = label.textContent?.trim();
		if (!text) continue;
		const slug = slugifyLabel(text);
		if (fieldMeta.has(slug)) {
			bump(slug);
			continue;
		}
		for (const name of fieldMeta.keys()) {
			if (slugifyLabel(name) === slug || slugifyLabel(fieldLabel(name)) === slug) {
				bump(name);
				break;
			}
		}
	}

	if (!votes.size) return null;
	return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

function resolveFieldName(el: HTMLElement, layoutKeys?: Set<string>, fieldMeta?: FieldMetaMap): string | null {
	const ourKey = el.getAttribute(KEY_ATTR);
	if (ourKey && (!fieldMeta?.size || !isGroupWrapper(el) || isGroupMeta(fieldMeta.get(ourKey)))) {
		// Still re-check groups below if stamp looks wrong.
		if (!isGroupWrapper(el)) return ourKey;
	}

	if (isGroupWrapper(el)) {
		const fromVue = fieldNameFromGroupVue(el);
		if (fromVue) return matchLayoutKey(fromVue, layoutKeys) || fromVue;

		if (fieldMeta?.size) {
			const fromChildren = fieldNameFromGroupChildren(el, fieldMeta);
			if (fromChildren) return matchLayoutKey(fromChildren, layoutKeys) || fromChildren;
		}

		const title = groupTitleText(el);
		if (title) {
			const fromTitle = matchLayoutKey(title, layoutKeys) || slugifyLabel(title);
			if (fromTitle) return fromTitle;
		}

		if (ourKey && fieldMeta?.size && !isGroupMeta(fieldMeta.get(ourKey))) {
			el.removeAttribute(KEY_ATTR);
			return null;
		}
		return ourKey;
	}

	const fromData = el.getAttribute('data-field');
	if (fromData) return fromData;

	const withFieldAttr = el.querySelector('[field]') as HTMLElement | null;
	const fromAttr = withFieldAttr?.getAttribute('field');
	if (fromAttr) return fromAttr;

	const fromVue = fieldNameFromVue(el);
	if (fromVue) return fromVue;

	return fieldNameFromLabel(el, layoutKeys);
}

function indexFormFields(
	form: HTMLElement,
	layoutKeys: Set<string>,
	fieldMeta: FieldMetaMap,
): {
	topLevel: Map<string, HTMLElement>;
	all: Map<string, HTMLElement>;
} {
	const topLevel = new Map<string, HTMLElement>();
	const all = new Map<string, HTMLElement>();

	for (const node of findTopLevelNodes(form)) {
		const name = resolveFieldName(node, layoutKeys, fieldMeta);
		if (!name) continue;
		stampKey(node, name);
		topLevel.set(name, node);
		all.set(name, node);
	}

	for (const node of Array.from(form.querySelectorAll('.field')) as HTMLElement[]) {
		if (isGroupWrapper(node)) continue;
		if (!isNestedUnderFormField(node, form)) continue;
		const name = resolveFieldName(node, layoutKeys, fieldMeta);
		if (!name || all.has(name)) continue;
		stampKey(node, name);
		all.set(name, node);
	}

	// Accordion / unnamed groups → leftover group layout keys only.
	const unnamed = findTopLevelNodes(form).filter(
		(node) => isGroupWrapper(node) && !resolveFieldName(node, layoutKeys, fieldMeta),
	);
	const candidates = [...layoutKeys].filter((key) => !all.has(key) && isGroupMeta(fieldMeta.get(key)));
	for (let i = 0; i < unnamed.length && i < candidates.length; i++) {
		const key = candidates[i]!;
		const node = unnamed[i]!;
		stampKey(node, key);
		topLevel.set(key, node);
		all.set(key, node);
	}

	return { topLevel, all };
}

function isDividerField(field: string): boolean {
	return field.endsWith('_divider') || field in DIVIDER_TITLES;
}

function dividerTitle(field: string): string {
	return DIVIDER_TITLES[field] || fieldLabel(field);
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function ensureDividerField(form: HTMLElement, field: string, collection: SupportedCollection): HTMLElement {
	const existing = form.querySelector(
		`:scope > .field[${INJECTED_DIVIDER_ATTR}="${field}"]`,
	) as HTMLElement | null;
	if (existing) return existing;

	for (const node of findTopLevelNodes(form)) {
		if (resolveFieldName(node) === field) return node;
	}

	const el = document.createElement('div');
	el.className = 'field full';
	el.setAttribute('data-field', field);
	el.setAttribute('data-collection', collection);
	el.setAttribute(KEY_ATTR, field);
	el.setAttribute(INJECTED_DIVIDER_ATTR, field);
	el.innerHTML =
		`<div class="interface">` +
		`<div class="v-divider large presentation-divider add-margin-block-start" style="--v-divider-color: var(--theme--border-color-subdued);">` +
		`<span class="wrapper"><span class="type-text">${escapeHtml(dividerTitle(field))}</span></span>` +
		`<hr aria-orientation="horizontal">` +
		`</div></div>`;
	form.appendChild(el);
	return el;
}

function removeInjectedDividers(form: HTMLElement, keep: Set<string> = new Set()) {
	for (const node of Array.from(form.querySelectorAll(`[${INJECTED_DIVIDER_ATTR}]`))) {
		const field = node.getAttribute(INJECTED_DIVIDER_ATTR);
		if (field && keep.has(field)) continue;
		node.remove();
	}
}

/** Attr-only width — never touch Directus half/full classes. */
function setWidth(el: HTMLElement, width: DisplayWidth) {
	if (el.getAttribute(WIDTH_ATTR) === width) return;
	el.setAttribute(WIDTH_ATTR, width);
}

function clearWidth(el: HTMLElement) {
	el.removeAttribute(WIDTH_ATTR);
}

function setFieldHidden(el: HTMLElement, hidden: boolean) {
	if (hidden) el.setAttribute(FIELD_HIDDEN_ATTR, 'true');
	else el.removeAttribute(FIELD_HIDDEN_ATTR);
}

function setOrder(el: HTMLElement, order: number) {
	const next = String(order);
	if (el.getAttribute(ORDER_ATTR) === next && el.style.getPropertyValue('--sf-order') === next) return;
	el.style.setProperty('--sf-order', next);
	el.setAttribute(ORDER_ATTR, next);
}

function clearOrder(el: HTMLElement) {
	if (!el.hasAttribute(ORDER_ATTR)) return;
	el.style.removeProperty('--sf-order');
	el.style.removeProperty('order'); // legacy inline order from older enforcer versions
	el.removeAttribute(ORDER_ATTR);
}

function displayWidthForVisibleHalf(configured: FieldWidth, prevDisplay: DisplayWidth | null): DisplayWidth {
	if (configured === 'half' && prevDisplay === 'half') return 'half-right';
	return configured;
}

function findPreviewEl(fileItem: HTMLElement): HTMLElement | null {
	return (
		(fileItem.querySelector(':scope > .preview') as HTMLElement | null) ||
		(fileItem.querySelector(':scope > .file-preview-replace') as HTMLElement | null)
	);
}

function ensurePreviewIsFileItemChild(fileItem: HTMLElement, preview: HTMLElement) {
	if (preview.parentElement === fileItem) return;
	const form = fileItem.querySelector('.v-form');
	if (form) fileItem.insertBefore(preview, form);
	else fileItem.insertBefore(preview, fileItem.firstChild);
	fileItem.querySelectorAll('[data-sf-preview-slot]').forEach((node) => node.remove());
}

/** Clear only our marks on an owned form. */
function clearOwnedForm(form: HTMLElement) {
	removeInjectedDividers(form);
	const stamped = Array.from(
		form.querySelectorAll(`[${ORDER_ATTR}], [${WIDTH_ATTR}], [${FIELD_HIDDEN_ATTR}], [${KEY_ATTR}]`),
	) as HTMLElement[];
	for (const el of stamped) {
		clearOrder(el);
		clearWidth(el);
		setFieldHidden(el, false);
		el.removeAttribute(KEY_ATTR);
		// Legacy: older builds stamped data-field on group wrappers incorrectly — only
		// remove if it matches a key we also stamped and the node is a group wrapper.
		if (isGroupWrapper(el) && el.getAttribute('data-field') && !el.querySelector(`[field="${el.getAttribute('data-field')}"]`)) {
			const df = el.getAttribute('data-field');
			// Don't strip Directus-native data-field on normal .field nodes.
			if (df && !el.classList.contains('field')) el.removeAttribute('data-field');
		}
	}
	form.removeAttribute(FORM_MARK);
}

function clearFileReflow() {
	const fileItem = findFileItem();
	if (!fileItem) return;
	fileItem.classList.remove(REFLOW_CLASS, 'sf-with-fill');
	const preview = findPreviewEl(fileItem);
	if (preview) {
		clearOrder(preview);
		clearWidth(preview);
	}
	fileItem.querySelectorAll('[data-sf-preview-slot]').forEach((node) => node.remove());
}

/** Tear down every owned form + file reflow. Safe on any Studio page. */
function clearAllEnforcedLayouts() {
	document.documentElement.classList.remove(HIDDEN_CLASS);
	clearFileReflow();
	for (const form of Array.from(document.querySelectorAll(`.v-form[${FORM_MARK}]`)) as HTMLElement[]) {
		clearOwnedForm(form);
	}
	// Legacy cleanup: attrs left by v19 and earlier without FORM_MARK.
	for (const form of Array.from(document.querySelectorAll('.v-form')) as HTMLElement[]) {
		if (form.hasAttribute(FORM_MARK)) continue;
		const legacy = form.querySelector(
			`[${ORDER_ATTR}], [${WIDTH_ATTR}], [${FIELD_HIDDEN_ATTR}], [${INJECTED_DIVIDER_ATTR}], [${KEY_ATTR}]`,
		);
		if (!legacy) continue;
		// Only scrub our attrs — never strip Directus width classes.
		for (const el of Array.from(
			form.querySelectorAll(`[${ORDER_ATTR}], [${WIDTH_ATTR}], [${FIELD_HIDDEN_ATTR}], [${KEY_ATTR}]`),
		) as HTMLElement[]) {
			clearOrder(el);
			clearWidth(el);
			setFieldHidden(el, false);
			el.removeAttribute(KEY_ATTR);
		}
		removeInjectedDividers(form);
	}
}

function applyLayoutToForm(
	form: HTMLElement,
	collection: SupportedCollection,
	layout: FieldLayoutEntry[],
	pinia: any,
	opts?: {
		preview?: HTMLElement | null;
		previewHints?: SystemFieldsConfig['preview'];
	},
) {
	markForm(form, collection);

	const layoutKeys = new Set(layout.map((entry) => entry.field));
	const fieldMeta = getCollectionFieldMeta(pinia, collection);
	const { topLevel, all: byName } = indexFormFields(form, layoutKeys, fieldMeta);

	let order = 0;
	const touched = new Set<string>();
	let prevVisibleDisplay: DisplayWidth | null = null;
	const preview = opts?.preview ?? null;
	const previewHints = opts?.previewHints;

	for (const entry of layout) {
		if (entry.field === FILE_PREVIEW_FIELD) {
			if (preview && entry.show !== false && previewHints?.show !== false) {
				setWidth(preview, 'full');
				setOrder(preview, order++);
				prevVisibleDisplay = 'full';
			}
			continue;
		}

		let node = byName.get(entry.field);
		if (!node && entry.show !== false && isDividerField(entry.field)) {
			node = ensureDividerField(form, entry.field, collection);
			byName.set(entry.field, node);
			topLevel.set(entry.field, node);
		}
		if (!node) continue;
		touched.add(entry.field);

		const isTopLevel = topLevel.has(entry.field);

		if (entry.show === false) {
			clearWidth(node);
			setFieldHidden(node, true);
			clearOrder(node);
			continue;
		}

		setFieldHidden(node, false);
		const configured = entry.width || 'full';
		const display = displayWidthForVisibleHalf(configured, prevVisibleDisplay);
		setWidth(node, display);
		if (isTopLevel) {
			setOrder(node, order++);
			prevVisibleDisplay = display;
		} else {
			setOrder(node, order);
		}
	}

	removeInjectedDividers(form, touched);

	if (preview && collection === 'directus_files' && !layout.some((entry) => entry.field === FILE_PREVIEW_FIELD)) {
		setWidth(preview, 'full');
		if (typeof previewHints?.sort === 'number') setOrder(preview, previewHints.sort);
		else setOrder(preview, -1);
	}

	for (const [name, node] of topLevel) {
		if (touched.has(name)) continue;
		clearWidth(node);
		setFieldHidden(node, true);
		clearOrder(node);
	}
}

function applyFilesLayout(layout: FieldLayoutEntry[], previewHints: SystemFieldsConfig['preview'], pinia: any) {
	const fileItem = findFileItem();
	const form = findFormRoot('directus_files');
	if (!fileItem || !form) return;

	const preview = findPreviewEl(fileItem);
	if (preview) ensurePreviewIsFileItemChild(fileItem, preview);

	if (previewHints?.show === false) document.documentElement.classList.add(HIDDEN_CLASS);
	else document.documentElement.classList.remove(HIDDEN_CLASS);

	fileItem.classList.add(REFLOW_CLASS);

	applyLayoutToForm(form, 'directus_files', layout, pinia, { preview, previewHints });
}

function applyUsersLayout(layout: FieldLayoutEntry[], pinia: any) {
	const form = findFormRoot('directus_users');
	if (!form) return;
	applyLayoutToForm(form, 'directus_users', layout, pinia);
}

function applyEnforcement(pinia: any, path: string) {
	ensureStyleEl();

	const collection = detectCollectionRoute(path);

	if (isAdminUser(pinia) || !collection) {
		clearAllEnforcedLayouts();
		return;
	}

	const config = getConfig(pinia);
	const layout = config.applied?.[collection] || null;

	if (!layout?.length) {
		clearAllEnforcedLayouts();
		return;
	}

	// Leaving the other owned collection — clear forms that are not the active one.
	for (const form of Array.from(document.querySelectorAll(`.v-form[${FORM_MARK}]`)) as HTMLElement[]) {
		if (form.getAttribute(FORM_MARK) !== collection) clearOwnedForm(form);
	}
	if (collection !== 'directus_files') {
		document.documentElement.classList.remove(HIDDEN_CLASS);
		clearFileReflow();
	}

	if (collection === 'directus_files') applyFilesLayout(layout, config.preview ?? null, pinia);
	else applyUsersLayout(layout, pinia);
}

/** Global Studio enforcer: field order/visibility/width + file preview chrome. */
export function installFilePreviewEnforcer(): void {
	if (typeof window === 'undefined') return;
	if ((window as any)[ENFORCER_FLAG]) return;

	for (const flag of LEGACY_FLAGS) {
		delete (window as any)[flag];
	}

	const started = Date.now();

	const timer = window.setInterval(() => {
		const appEl = document.querySelector('#app') as any;
		const app = appEl?.__vue_app__;
		const router = app?.config?.globalProperties?.$router;
		const pinia = getPinia(app);

		if (!app || !router || !pinia) {
			if (Date.now() - started > 45000) window.clearInterval(timer);
			return;
		}

		window.clearInterval(timer);
		(window as any)[ENFORCER_FLAG] = true;

		let scheduled = false;
		let applying = false;

		const run = () => {
			if (scheduled || applying) return;
			scheduled = true;
			window.requestAnimationFrame(() => {
				scheduled = false;
				applying = true;
				try {
					applyEnforcement(pinia, getRoutePath(router));
				} catch {
					/* ignore */
				} finally {
					queueMicrotask(() => {
						applying = false;
					});
				}
			});
		};

		run();

		router.afterEach(() => {
			window.setTimeout(run, 0);
			window.setTimeout(run, 120);
			window.setTimeout(run, 400);
			window.setTimeout(run, 900);
		});

		// collection=/field= attrs often appear after the .v-form childList mount.
		const observer = new MutationObserver((mutations) => {
			if (applying || scheduled) return;
			try {
				if (!detectCollectionRoute(getRoutePath(router))) return;
				if (isAdminUser(pinia)) return;
			} catch {
				return;
			}

			const relevant = mutations.some((m) => {
				if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) return true;
				if (m.type === 'attributes') {
					const name = m.attributeName;
					return name === 'collection' || name === 'data-collection' || name === 'field' || name === 'class';
				}
				return false;
			});
			if (!relevant) return;
			run();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['collection', 'data-collection', 'field', 'class'],
		});
	}, 150);
}
