<template>
	<div
		class="field-select"
		:class="[widthClass, { hidden: entry.show === false, group: isGroup }]"
		data-draggable="true"
	>
		<!-- Group: Data Model-style nested chrome -->
		<div v-if="isGroup" class="field-grid group nested" :class="widthClass">
			<div class="header full">
				<v-icon class="drag-handle group-drag-handle" name="drag_indicator" @click.stop />
				<span class="name">{{ label }}</span>
				<span v-if="interfaceName" class="interface">{{ interfaceName }}</span>
				<v-icon
					v-if="entry.show === false"
					v-tooltip="'Hidden on form'"
					name="visibility_off"
					class="hidden-icon"
					small
				/>
				<v-menu show-arrow placement="bottom-end">
					<template #activator="{ toggle }">
						<v-icon clickable name="more_vert" @click.stop="toggle" />
					</template>
					<v-list>
						<v-list-item clickable @click="emit('toggle-show')">
							<v-list-item-icon>
								<v-icon :name="entry.show === false ? 'visibility' : 'visibility_off'" />
							</v-list-item-icon>
							<v-list-item-content>
								{{ entry.show === false ? 'Show group' : 'Hide group' }}
							</v-list-item-content>
						</v-list-item>
						<v-divider />
						<v-list-item clickable disabled>
							<v-list-item-icon><v-icon name="border_vertical" /></v-list-item-icon>
							<v-list-item-content>Half Width</v-list-item-content>
						</v-list-item>
						<v-list-item clickable disabled>
							<v-list-item-icon><v-icon name="border_right" /></v-list-item-icon>
							<v-list-item-content>Full Width</v-list-item-content>
						</v-list-item>
						<v-list-item clickable disabled>
							<v-list-item-icon><v-icon name="aspect_ratio" /></v-list-item-icon>
							<v-list-item-content>Fill Width</v-list-item-content>
						</v-list-item>
					</v-list>
				</v-menu>
			</div>
			<slot />
		</div>

		<!-- Regular field / divider / file preview -->
		<v-input v-else class="field" :class="{ hidden: entry.show === false }" readonly>
			<template #prepend>
				<v-icon class="drag-handle field-drag-handle" name="drag_indicator" @click.stop />
			</template>

			<template #input>
				<div class="label">
					<div class="label-inner">
						<span class="name">{{ label }}</span>
						<span v-if="interfaceName" class="interface">{{ interfaceName }}</span>
					</div>
				</div>
			</template>

			<template #append>
				<div class="icons">
					<v-icon
						v-if="entry.show === false"
						v-tooltip="'Hidden on form'"
						name="visibility_off"
						class="hidden-icon"
						small
					/>

					<v-menu show-arrow placement="bottom-end">
						<template #activator="{ toggle }">
							<v-icon clickable name="more_vert" @click.stop="toggle" />
						</template>

						<v-list>
							<v-list-item clickable @click="emit('toggle-show')">
								<v-list-item-icon>
									<v-icon :name="entry.show === false ? 'visibility' : 'visibility_off'" />
								</v-list-item-icon>
								<v-list-item-content>
									{{ entry.show === false ? 'Show field' : 'Hide field' }}
								</v-list-item-content>
							</v-list-item>

							<template v-if="!isFilePreview">
								<v-divider />

								<v-list-item
									clickable
									:disabled="entry.width === 'half'"
									@click="emit('set-width', 'half')"
								>
									<v-list-item-icon><v-icon name="border_vertical" /></v-list-item-icon>
									<v-list-item-content>Half Width</v-list-item-content>
								</v-list-item>

								<v-list-item
									clickable
									:disabled="entry.width === 'full'"
									@click="emit('set-width', 'full')"
								>
									<v-list-item-icon><v-icon name="border_right" /></v-list-item-icon>
									<v-list-item-content>Full Width</v-list-item-content>
								</v-list-item>

								<v-list-item
									clickable
									:disabled="entry.width === 'fill'"
									@click="emit('set-width', 'fill')"
								>
									<v-list-item-icon><v-icon name="aspect_ratio" /></v-list-item-icon>
									<v-list-item-content>Fill Width</v-list-item-content>
								</v-list-item>
							</template>
						</v-list>
					</v-menu>
				</div>
			</template>
		</v-input>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { FILE_PREVIEW_FIELD, type FieldLayoutEntry, type FieldWidth } from '../shared/types';

const props = defineProps<{
	entry: FieldLayoutEntry;
	label: string;
	interfaceName?: string;
	isGroup?: boolean;
}>();

const emit = defineEmits<{
	'toggle-show': [];
	'set-width': [FieldWidth];
}>();

const isFilePreview = computed(() => props.entry.field === FILE_PREVIEW_FIELD);
const widthClass = computed(() => (isFilePreview.value ? 'full' : props.entry.width || 'full'));
</script>

<style scoped>
/* Theme tokens: Directus 10+ uses --theme--; Directus 9 falls back to older vars. */
.field-select {
	--sf-border-width: var(--theme--border-width, var(--border-width, 2px));
	--sf-border-color: var(--theme--border-color-subdued, var(--border-subdued, var(--border-normal, #e4eaf1)));
	--sf-border-color-hover: var(
		--theme--form--field--input--border-color-hover,
		var(--theme--border-color-accent, var(--border-normal, #d3dae4))
	);
	--sf-fg-subdued: var(--theme--foreground-subdued, var(--foreground-subdued, #a2b5cd));
	--sf-bg: var(--theme--form--field--input--background, var(--theme--background, var(--background-page, #fff)));
	--sf-bg-subdued: var(--theme--background-subdued, var(--background-subdued, #f7fafc));
	--sf-radius: var(--theme--border-radius, var(--border-radius, 6px));
	--sf-primary: var(--theme--primary, var(--primary, var(--project-color, #6644ff)));
	--sf-primary-subdued: var(--theme--primary-subdued, var(--primary-subdued, #c8bfff));
	--sf-warning: var(--theme--warning, var(--warning, #ffa439));
	--sf-mono: var(--theme--fonts--monospace--font-family, var(--family-monospace, monospace));
	--sf-input-pad: var(--theme--form--field--input--padding, 0.4375rem);
	--input-height: 2.25rem;
	--theme--form--field--input--padding: var(--sf-input-pad);
	user-select: none;
	margin: 0.25rem;
}

.full,
.fill {
	grid-column: 1 / span 2;
}

.half {
	grid-column: span 1;
}

.drag-handle {
	cursor: grab;
}

.v-icon {
	--v-icon-color: var(--sf-fg-subdued);
}

.label {
	inline-size: 100%;
	overflow: hidden;
}

.label-inner {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.name {
	margin-inline-end: 0.4375rem;
	font-family: var(--sf-mono);
}

.interface {
	color: var(--sf-fg-subdued);
	font-family: var(--sf-mono);
	font-size: 12px;
	opacity: 0;
	transition: opacity var(--fast, 125ms) var(--transition, ease-in);
}

.field:hover .interface,
.header:hover .interface {
	opacity: 1;
}

.icons {
	display: flex;
	align-items: center;
	gap: 0.25rem;
}

.hidden-icon {
	--v-icon-color: var(--sf-warning);
}

.field.hidden {
	--theme--background: var(--sf-bg-subdued);
	--background-page: var(--sf-bg-subdued);
	--v-input-color: var(--sf-fg-subdued);
}

/* Paint the chrome ourselves so v9 (missing theme tokens) still shows a bordered row. */
.field :deep(.input),
.field :deep(.v-input > .input),
.field.v-input :deep(.input) {
	border: var(--sf-border-width) solid var(--sf-border-color) !important;
	border-radius: var(--sf-radius);
	background-color: var(--sf-bg);
	min-block-size: var(--input-height);
}

.field :deep(.input:hover),
.field :deep(.v-input > .input:hover) {
	border-color: var(--sf-border-color-hover) !important;
}

.field-grid.group {
	position: relative;
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	gap: 0.4375rem;
	min-block-size: var(--theme--form--field--input--height, 2.25rem);
	padding: var(--sf-input-pad);
	padding-block: 2.25rem 0.875rem;
	border-radius: var(--sf-radius);
}

.field-grid.group > *:not(.header) {
	position: relative;
	z-index: 2;
}

.field-grid.group::before {
	position: absolute;
	inset-block-start: 0;
	inset-inline-start: -0.125rem;
	z-index: 1;
	inline-size: 0.25rem;
	block-size: 100%;
	background-color: var(--sf-primary);
	border-radius: 0.125rem;
	content: '';
}

.field-grid.group::after {
	position: absolute;
	inset-block-start: 0;
	inset-inline-start: 0;
	z-index: 1;
	inline-size: 100%;
	block-size: 100%;
	background-color: var(--sf-primary);
	opacity: 0.1;
	border-radius: var(--sf-radius);
	content: '';
}

.field-grid.group.nested {
	width: 100%;
}

.field-grid.group.nested :deep(.field .input) {
	border: var(--sf-border-width) solid var(--sf-primary-subdued) !important;
}

.header {
	position: absolute;
	inset-block-start: 0;
	inset-inline-start: 0;
	z-index: 2;
	display: flex;
	align-items: center;
	gap: 0.5rem;
	inline-size: 100%;
	min-height: 2rem;
	padding: 0.4375rem var(--sf-input-pad) 0;
	color: var(--sf-primary);
	font-family: var(--sf-mono);
}

.header .drag-handle {
	--v-icon-color: var(--sf-primary);
}

.header .name {
	flex-grow: 1;
	min-width: 0;
	margin-inline-end: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-weight: 600;
}

.header .interface {
	flex-shrink: 0;
}

.field-select.hidden .field-grid.group {
	opacity: 0.65;
}
</style>
