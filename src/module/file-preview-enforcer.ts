import { normalizeConfig } from '../shared/evaluate';
import { userHasAdminAccess } from '../shared/admin';
import { DEFAULT_FIELDS, fieldLabel } from '../shared/catalogs';
import {
	FILE_PREVIEW_FIELD,
	SYSTEM_FIELDS_FIELD,
	type FieldLayoutEntry,
	type FieldWidth,
	type SupportedCollection,
	type SystemFieldsConfig,
} from '../shared/types';

const ENFORCER_FLAG = '__systemFieldsLayoutEnforcerV15';
const STYLE_ID = 'sf-layout-enforcer-styles-v15';
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
];
const HIDDEN_CLASS = 'sf-file-preview-hidden';
const REFLOW_CLASS = 'sf-reflow';
const FIELD_HIDDEN_ATTR = 'data-sf-field-hidden';
const ORDER_ATTR = 'data-sf-order';
const WIDTH_ATTR = 'data-sf-width';
const INJECTED_DIVIDER_ATTR = 'data-sf-injected-divider';
const WIDTH_CLASSES = ['half', 'half-right', 'half-left', 'full', 'fill'] as const;

/** Studio titles for presentation-divider fields (i18n keys differ from fieldLabel). */
const DIVIDER_TITLES: Record<string, string> = {
	preferences_divider: 'User Preferences',
	admin_divider: 'Admin Options',
	theming_divider: 'Theming',
	focal_point_divider: 'Focal Point',
	storage_divider: 'Storage Details',
};

type LooseStore = {
	currentUser?: {
		admin_access?: boolean;
		role?: unknown;
	} | null;
	settings?: {
		[SYSTEM_FIELDS_FIELD]?: SystemFieldsConfig | null;
	} | null;
};

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

function detectCollectionRoute(path: string): SupportedCollection | null {
	const parts = path.split('/').filter(Boolean);
	if (parts[0] === 'files') {
		if (parts.length === 2 && parts[1] !== 'folders') return 'directus_files';
		if (parts.length === 4 && parts[1] === 'folders') return 'directus_files';
		return null;
	}
	if (parts[0] === 'users') {
		if (parts.length === 2) return 'directus_users';
		return null;
	}
	return null;
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

	/**
	 * Always use Directus's with-fill column template so "full" = two
	 * --form-column-max-width tracks, and only "fill" uses the leftover 1fr track.
	 * (display:contents on .v-form otherwise loses native .with-fill.)
	 *
	 * Do NOT use `.half + .half` — CSS order reorders visually but not DOM siblings,
	 * so adjacent-sibling rules fight our explicit half / half-right pairing.
	 */
	el.textContent = `
html.${HIDDEN_CLASS} .file-item > .preview,
html.${HIDDEN_CLASS} .file-item > .file-preview-replace {
	display: none !important;
}

.v-form .field[${FIELD_HIDDEN_ATTR}="true"] {
	display: none !important;
}

/*
 * Users form: Directus .with-fill adds a trailing 1fr track (page blank).
 * Native .field defaults to start/fill until a container query; our injected
 * dividers (and order-based widths) must pin to start/full so they never
 * auto-place into that blank column.
 */
.v-form.grid .field[${INJECTED_DIVIDER_ATTR}],
.v-form.grid .field[${WIDTH_ATTR}="full"] {
	grid-column: start / full !important;
	min-inline-size: 0;
}
.v-form.grid .field[${WIDTH_ATTR}="half"] {
	grid-column: start / half !important;
	min-inline-size: 0;
}
.v-form.grid .field[${WIDTH_ATTR}="half-right"] {
	grid-column: half / full !important;
	min-inline-size: 0;
}
@container (inline-size < 31.25rem) {
	.v-form.grid .field[${WIDTH_ATTR}="half"],
	.v-form.grid .field[${WIDTH_ATTR}="half-right"] {
		grid-column: start / full !important;
	}
}

.file-item.${REFLOW_CLASS} {
	display: grid !important;
	/* Same as Directus .v-form.grid.with-fill */
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
.file-item.${REFLOW_CLASS} .field {
	order: var(--sf-order, 1000);
	grid-column: start / full !important;
}
.file-item.${REFLOW_CLASS} .field.full,
.file-item.${REFLOW_CLASS} > .preview.full,
.file-item.${REFLOW_CLASS} > .file-preview-replace.full,
.file-item.${REFLOW_CLASS} > .preview[${WIDTH_ATTR}="full"],
.file-item.${REFLOW_CLASS} > .file-preview-replace[${WIDTH_ATTR}="full"] {
	grid-column: start / full !important;
}
.file-item.${REFLOW_CLASS} .field.fill,
.file-item.${REFLOW_CLASS} > .preview.fill,
.file-item.${REFLOW_CLASS} > .file-preview-replace.fill,
.file-item.${REFLOW_CLASS} > .preview[${WIDTH_ATTR}="fill"],
.file-item.${REFLOW_CLASS} > .file-preview-replace[${WIDTH_ATTR}="fill"] {
	grid-column: start / fill !important;
}
.file-item.${REFLOW_CLASS} > .preview.fill .file-preview,
.file-item.${REFLOW_CLASS} > .file-preview-replace.fill .file-preview,
.file-item.${REFLOW_CLASS} > .preview[${WIDTH_ATTR}="fill"] .file-preview,
.file-item.${REFLOW_CLASS} > .file-preview-replace[${WIDTH_ATTR}="fill"] .file-preview {
	max-inline-size: none;
}
.file-item.${REFLOW_CLASS} .field.half,
.file-item.${REFLOW_CLASS} .field.half-left,
.file-item.${REFLOW_CLASS} .field.half-space,
.file-item.${REFLOW_CLASS} > .preview.half,
.file-item.${REFLOW_CLASS} > .file-preview-replace.half,
.file-item.${REFLOW_CLASS} .field[${WIDTH_ATTR}="half"],
.file-item.${REFLOW_CLASS} > .preview[${WIDTH_ATTR}="half"],
.file-item.${REFLOW_CLASS} > .file-preview-replace[${WIDTH_ATTR}="half"] {
	grid-column: start / half !important;
}
.file-item.${REFLOW_CLASS} .field.half-right,
.file-item.${REFLOW_CLASS} > .preview.half-right,
.file-item.${REFLOW_CLASS} > .file-preview-replace.half-right,
.file-item.${REFLOW_CLASS} .field[${WIDTH_ATTR}="half-right"],
.file-item.${REFLOW_CLASS} > .preview[${WIDTH_ATTR}="half-right"],
.file-item.${REFLOW_CLASS} > .file-preview-replace[${WIDTH_ATTR}="half-right"] {
	grid-column: half / full !important;
}
@container (inline-size < 31.25rem) {
	.file-item.${REFLOW_CLASS} .field.half,
	.file-item.${REFLOW_CLASS} .field.half-left,
	.file-item.${REFLOW_CLASS} .field.half-right,
	.file-item.${REFLOW_CLASS} .field.half-space,
	.file-item.${REFLOW_CLASS} > .preview.half,
	.file-item.${REFLOW_CLASS} > .file-preview-replace.half,
	.file-item.${REFLOW_CLASS} > .preview.half-right,
	.file-item.${REFLOW_CLASS} > .file-preview-replace.half-right,
	.file-item.${REFLOW_CLASS} .field[${WIDTH_ATTR}="half"],
	.file-item.${REFLOW_CLASS} .field[${WIDTH_ATTR}="half-right"],
	.file-item.${REFLOW_CLASS} > .preview[${WIDTH_ATTR}="half"],
	.file-item.${REFLOW_CLASS} > .file-preview-replace[${WIDTH_ATTR}="half"],
	.file-item.${REFLOW_CLASS} > .preview[${WIDTH_ATTR}="half-right"],
	.file-item.${REFLOW_CLASS} > .file-preview-replace[${WIDTH_ATTR}="half-right"] {
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

function findFormRoot(collection: SupportedCollection): HTMLElement | null {
	if (collection === 'directus_files') {
		return (document.querySelector('.file-item .v-form') || document.querySelector('.v-form')) as HTMLElement | null;
	}
	return (
		(document.querySelector('#main-content .v-form') ||
			document.querySelector('.private-view .v-form') ||
			document.querySelector('.v-form')) as HTMLElement | null
	);
}

function findFormFields(form: HTMLElement): HTMLElement[] {
	return Array.from(form.querySelectorAll(':scope > .field, :scope > div.field')) as HTMLElement[];
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

/**
 * Directus often omits presentation-divider fields from the form when the
 * viewer lacks field-level read permission (alias/no-data still goes through ACL).
 * Inject a lightweight stand-in so visible layout entries still render.
 */
function ensureDividerField(form: HTMLElement, field: string, collection: SupportedCollection): HTMLElement {
	for (const node of findFormFields(form)) {
		if (fieldName(node) === field) {
			if (node.hasAttribute(INJECTED_DIVIDER_ATTR)) {
				node.style.gridColumn = 'start / full';
			}
			return node;
		}
	}

	const existing = form.querySelector(
		`:scope > .field[${INJECTED_DIVIDER_ATTR}="${field}"]`,
	) as HTMLElement | null;
	if (existing) {
		existing.style.gridColumn = 'start / full';
		return existing;
	}

	const el = document.createElement('div');
	el.className = 'field full';
	el.setAttribute('data-field', field);
	el.setAttribute('data-collection', collection);
	el.setAttribute(INJECTED_DIVIDER_ATTR, field);
	// Inline fallback: without this, auto-placement can drop into the with-fill 1fr track.
	el.style.gridColumn = 'start / full';
	el.innerHTML =
		`<div class="interface">` +
		`<div class="v-divider large presentation-divider add-margin-block-start" style="--v-divider-color: var(--theme--border-color-subdued);">` +
		`<span class="wrapper"><span class="type-text">${escapeHtml(dividerTitle(field))}</span></span>` +
		`<hr aria-orientation="horizontal">` +
		`</div></div>`;
	form.appendChild(el);
	return el;
}

function removeInjectedDividers(form: HTMLElement | null, keep: Set<string> = new Set()) {
	if (!form) return;
	for (const node of Array.from(form.querySelectorAll(`[${INJECTED_DIVIDER_ATTR}]`))) {
		const field = node.getAttribute(INJECTED_DIVIDER_ATTR);
		if (field && keep.has(field)) continue;
		node.remove();
	}
}

/** Directus i18n labels that differ from our catalog's fieldLabel(). */
const FIELD_LABEL_ALIASES: Record<string, string> = {
	'Two-Factor Authentication': 'tfa_secret',
	'User Preferences': 'preferences_divider',
	'Admin Options': 'admin_divider',
	Theming: 'theming_divider',
	'Storage Details': 'storage_divider',
	'Focal Point': 'focal_point_divider',
};

function fieldKeyFromUnknown(value: unknown): string | null {
	if (typeof value === 'string' && value && value !== 'true' && value !== 'false') return value;
	if (value && typeof value === 'object' && typeof (value as { field?: unknown }).field === 'string') {
		return (value as { field: string }).field;
	}
	return null;
}

function fieldNameFromVue(el: HTMLElement): string | null {
	// Vue 2 (Directus 9.x)
	const vue2Candidates = [el, el.firstElementChild, el.querySelector('.interface')].filter(Boolean) as HTMLElement[];
	for (const node of vue2Candidates) {
		const vue2 = (node as any).__vue__;
		if (!vue2) continue;
		const fromVue2 =
			fieldKeyFromUnknown(vue2.field) ||
			fieldKeyFromUnknown(vue2.$props?.field) ||
			fieldKeyFromUnknown(vue2.$attrs?.field);
		if (fromVue2) return fromVue2;
	}

	// Vue 3: walk parent components from the field root and a few descendants
	const roots = [el, el.firstElementChild, el.querySelector('.interface'), el.querySelector('input,textarea,button')].filter(
		Boolean,
	) as HTMLElement[];

	for (const root of roots) {
		let vnode = (root as any).__vueParentComponent;
		for (let depth = 0; depth < 14 && vnode; depth++) {
			const fromProps = fieldKeyFromUnknown(vnode.props?.field);
			if (fromProps) return fromProps;
			const setup = vnode.setupState;
			if (setup && typeof setup === 'object') {
				const fromSetup = fieldKeyFromUnknown((setup as any).field);
				if (fromSetup) return fromSetup;
			}
			vnode = vnode.parent;
		}
	}

	return null;
}

function fieldNameFromLabel(el: HTMLElement): string | null {
	const labelEl =
		(el.querySelector('.field-label .v-text-overflow') as HTMLElement | null) ||
		(el.querySelector('.field-name .v-text-overflow') as HTMLElement | null) ||
		(el.querySelector('.v-divider .type-text') as HTMLElement | null);
	const text = labelEl?.textContent?.trim();
	if (!text) return null;

	if (FIELD_LABEL_ALIASES[text]) return FIELD_LABEL_ALIASES[text];

	for (const entry of DEFAULT_FIELDS.directus_users) {
		if (fieldLabel(entry.field) === text) return entry.field;
	}
	for (const entry of DEFAULT_FIELDS.directus_files) {
		if (entry.field === FILE_PREVIEW_FIELD) continue;
		if (fieldLabel(entry.field) === text) return entry.field;
	}

	return null;
}

/**
 * Resolve a form field's key from a `.field` node.
 * Directus ≥11.7 sets `data-field` on the root; older Studio often only
 * exposes the key on interface roots / Vue props (password/avatar/role have no DOM `field`).
 */
function fieldName(el: HTMLElement): string | null {
	const fromData = el.getAttribute('data-field');
	if (fromData) return fromData;

	const withFieldAttr = el.querySelector('[field]') as HTMLElement | null;
	const fromAttr = withFieldAttr?.getAttribute('field');
	if (fromAttr) return fromAttr;

	const fromVue = fieldNameFromVue(el);
	if (fromVue) return fromVue;

	return fieldNameFromLabel(el);
}

type DisplayWidth = FieldWidth | 'half-right';

function setWidthClass(el: HTMLElement, width: DisplayWidth) {
	if (el.getAttribute(WIDTH_ATTR) === width && el.classList.contains(width)) {
		let extras = false;
		for (const cls of WIDTH_CLASSES) {
			if (cls !== width && el.classList.contains(cls)) {
				extras = true;
				break;
			}
		}
		if (!extras) return;
	}
	for (const cls of WIDTH_CLASSES) {
		if (cls !== width) el.classList.remove(cls);
	}
	el.classList.add(width);
	el.setAttribute(WIDTH_ATTR, width);
}

function clearWidthClass(el: HTMLElement) {
	let changed = el.hasAttribute(WIDTH_ATTR);
	for (const cls of WIDTH_CLASSES) {
		if (el.classList.contains(cls)) {
			el.classList.remove(cls);
			changed = true;
		}
	}
	if (changed) el.removeAttribute(WIDTH_ATTR);
}

function setFieldHidden(el: HTMLElement, hidden: boolean) {
	if (hidden) {
		if (el.getAttribute(FIELD_HIDDEN_ATTR) === 'true') return;
		el.setAttribute(FIELD_HIDDEN_ATTR, 'true');
	} else if (el.hasAttribute(FIELD_HIDDEN_ATTR)) {
		el.removeAttribute(FIELD_HIDDEN_ATTR);
	}
}

/**
 * Directus pairs consecutive visible halves as half + half-right.
 * Hidden nodes stay in the DOM, so CSS `.half + .half` would wrongly push
 * every following half to the right column — assign classes from visible order only.
 */
function displayWidthForVisibleHalf(configured: FieldWidth, prevDisplay: DisplayWidth | null): DisplayWidth {
	if (configured === 'half' && prevDisplay === 'half') return 'half-right';
	return configured;
}

function setOrder(el: HTMLElement, order: number) {
	const next = String(order);
	if (el.getAttribute(ORDER_ATTR) === next && el.style.order === next && el.style.getPropertyValue('--sf-order') === next) {
		return;
	}
	el.style.setProperty('--sf-order', next);
	el.style.order = next;
	el.setAttribute(ORDER_ATTR, next);
}

function clearOrder(el: HTMLElement) {
	if (!el.hasAttribute(ORDER_ATTR) && !el.style.order && !el.style.getPropertyValue('--sf-order')) return;
	el.style.removeProperty('--sf-order');
	el.style.removeProperty('order');
	el.removeAttribute(ORDER_ATTR);
}

function findPreviewEl(fileItem: HTMLElement): HTMLElement | null {
	return (
		(fileItem.querySelector(':scope > .preview') as HTMLElement | null) ||
		(fileItem.querySelector(':scope > .file-preview-replace') as HTMLElement | null) ||
		(fileItem.querySelector('.preview') as HTMLElement | null)
	);
}

/** Undo any legacy DOM moves that put the preview inside .v-form */
function ensurePreviewIsFileItemChild(fileItem: HTMLElement, preview: HTMLElement) {
	if (preview.parentElement === fileItem) return;
	const form = fileItem.querySelector('.v-form');
	if (form) fileItem.insertBefore(preview, form);
	else fileItem.insertBefore(preview, fileItem.firstChild);
	fileItem.querySelectorAll('[data-sf-preview-slot]').forEach((node) => node.remove());
}

function clearReflow(fileItem: HTMLElement | null, form: HTMLElement | null) {
	if (fileItem) {
		fileItem.classList.remove(REFLOW_CLASS, 'sf-with-fill');
		const preview = findPreviewEl(fileItem);
		if (preview) {
			clearOrder(preview);
			clearWidthClass(preview);
		}
	}
	if (form) {
		removeInjectedDividers(form);
		for (const field of findFormFields(form)) {
			clearOrder(field);
			clearWidthClass(field);
			setFieldHidden(field, false);
		}
	}
	document.querySelectorAll('[data-sf-preview-slot]').forEach((node) => node.remove());
}

function applyFilesLayout(layout: FieldLayoutEntry[], previewHints: SystemFieldsConfig['preview']) {
	const fileItem = findFileItem();
	const form = findFormRoot('directus_files');
	if (!fileItem || !form) return;

	const preview = findPreviewEl(fileItem);
	if (preview) ensurePreviewIsFileItemChild(fileItem, preview);

	if (previewHints?.show === false) {
		if (!document.documentElement.classList.contains(HIDDEN_CLASS)) {
			document.documentElement.classList.add(HIDDEN_CLASS);
		}
	} else if (document.documentElement.classList.contains(HIDDEN_CLASS)) {
		document.documentElement.classList.remove(HIDDEN_CLASS);
	}

	if (!fileItem.classList.contains(REFLOW_CLASS)) {
		fileItem.classList.add(REFLOW_CLASS);
	}

	const byName = new Map<string, HTMLElement>();
	for (const node of findFormFields(form)) {
		const name = fieldName(node);
		if (name) byName.set(name, node);
	}

	let order = 0;
	const touched = new Set<string>();
	let prevVisibleDisplay: DisplayWidth | null = null;

	for (const entry of layout) {
		if (entry.field === FILE_PREVIEW_FIELD) {
			if (preview && entry.show !== false && previewHints?.show !== false) {
				setWidthClass(preview, 'full');
				setOrder(preview, order++);
				prevVisibleDisplay = 'full';
			}
			continue;
		}

		let node = byName.get(entry.field);
		if (!node && entry.show !== false && isDividerField(entry.field)) {
			node = ensureDividerField(form, entry.field, 'directus_files');
			byName.set(entry.field, node);
		}
		if (!node) continue;
		touched.add(entry.field);

		if (entry.show === false) {
			// Drop half classes so hidden siblings don't trigger `.half + .half`
			clearWidthClass(node);
			setFieldHidden(node, true);
			clearOrder(node);
			continue;
		}

		setFieldHidden(node, false);
		const configured = entry.width || 'full';
		const display = displayWidthForVisibleHalf(configured, prevVisibleDisplay);
		setWidthClass(node, display);
		setOrder(node, order++);
		prevVisibleDisplay = display;
	}

	removeInjectedDividers(form, touched);

	if (preview && !layout.some((entry) => entry.field === FILE_PREVIEW_FIELD)) {
		setWidthClass(preview, 'full');
		if (previewHints == null) {
			setOrder(preview, -1);
		} else if (typeof previewHints.sort === 'number') {
			setOrder(preview, previewHints.sort);
		} else {
			setOrder(preview, -1);
		}
	}

	// Layout is authoritative: version-specific / unlisted fields (e.g. v9 `theme`) stay hidden.
	for (const node of findFormFields(form)) {
		const name = fieldName(node);
		if (name && touched.has(name)) continue;
		clearWidthClass(node);
		setFieldHidden(node, true);
		clearOrder(node);
	}
}

function clearUsersLayout(form: HTMLElement | null) {
	if (!form) return;
	removeInjectedDividers(form);
	for (const field of findFormFields(form)) {
		clearOrder(field);
		clearWidthClass(field);
		setFieldHidden(field, false);
	}
}

/**
 * Users layout: hide + CSS order/width (no DOM moves — appendChild fights Vue and
 * leaves unmatched fields like password/avatar/role stranded at the top).
 */
function applyUsersLayout(layout: FieldLayoutEntry[]) {
	const form = findFormRoot('directus_users');
	if (!form) return;

	const byName = new Map<string, HTMLElement>();
	for (const node of findFormFields(form)) {
		const name = fieldName(node);
		if (name) byName.set(name, node);
	}

	let order = 0;
	const touched = new Set<string>();
	let prevVisibleDisplay: DisplayWidth | null = null;

	for (const entry of layout) {
		let node = byName.get(entry.field);
		if (!node && entry.show !== false && isDividerField(entry.field)) {
			node = ensureDividerField(form, entry.field, 'directus_users');
			byName.set(entry.field, node);
		}
		if (!node) continue;
		touched.add(entry.field);

		if (entry.show === false) {
			clearWidthClass(node);
			setFieldHidden(node, true);
			clearOrder(node);
			continue;
		}

		setFieldHidden(node, false);
		const configured = entry.width || 'full';
		const display = displayWidthForVisibleHalf(configured, prevVisibleDisplay);
		setWidthClass(node, display);
		setOrder(node, order++);
		prevVisibleDisplay = display;
	}

	removeInjectedDividers(form, touched);

	// Layout is authoritative: fields not listed (or unresolvable) stay hidden.
	for (const node of findFormFields(form)) {
		const name = fieldName(node);
		if (name && touched.has(name)) continue;
		clearWidthClass(node);
		setFieldHidden(node, true);
		clearOrder(node);
	}
}

function applyEnforcement(pinia: any, path: string) {
	ensureStyleEl();

	const collection = detectCollectionRoute(path);

	if (isAdminUser(pinia) || !collection) {
		document.documentElement.classList.remove(HIDDEN_CLASS);
		clearReflow(findFileItem(), findFormRoot('directus_files'));
		clearUsersLayout(findFormRoot('directus_users'));
		return;
	}

	const config = getConfig(pinia);
	const layout = config.applied?.[collection] || null;

	if (!layout?.length) {
		document.documentElement.classList.remove(HIDDEN_CLASS);
		if (collection === 'directus_files') {
			clearReflow(findFileItem(), findFormRoot('directus_files'));
		} else if (collection === 'directus_users') {
			clearUsersLayout(findFormRoot('directus_users'));
		}
		return;
	}

	if (collection === 'directus_files') {
		applyFilesLayout(layout, config.preview ?? null);
		return;
	}

	applyUsersLayout(layout);
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
			if (Date.now() - started > 45000) {
				window.clearInterval(timer);
			}
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
					const path = router.currentRoute?.value?.path || window.location.pathname;
					applyEnforcement(pinia, String(path));
				} catch {
					// ignore
				} finally {
					// Let our own attr writes settle before observing again.
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

		// React to Vue remounts without rewriting attrs every tick (that blinks DevTools).
		const observer = new MutationObserver((mutations) => {
			if (applying || scheduled) return;
			try {
				const path = router.currentRoute?.value?.path || window.location.pathname;
				if (!detectCollectionRoute(String(path))) return;
				if (isAdminUser(pinia)) return;
			} catch {
				return;
			}

			const structural = mutations.some((m) => m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0));
			if (!structural) return;
			run();
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}, 150);
}
