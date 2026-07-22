<template>
	<div
		class="field-select"
		:class="[isFilePreview ? 'full' : entry.width || 'full', { hidden: entry.show === false }]"
	>
		<v-input class="field" :class="{ hidden: entry.show === false }" readonly>
			<template #prepend>
				<v-icon class="drag-handle" name="drag_indicator" @click.stop />
			</template>

			<template #input>
				<div class="label">
					<div class="label-inner">
						<span class="name">{{ label }}</span>
						<span class="interface">{{ entry.field }}</span>
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
}>();

const emit = defineEmits<{
	'toggle-show': [];
	'set-width': [FieldWidth];
}>();

const isFilePreview = computed(() => props.entry.field === FILE_PREVIEW_FIELD);
</script>

<style scoped>
.field-select {
	--input-height: 2.25rem;
	--theme--form--field--input--padding: 0.4375rem;
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
	--v-icon-color: var(--theme--foreground-subdued);
}

.label {
	inline-size: 100%;
	overflow: hidden;
}

.label-inner {
	display: flex;
	align-items: baseline;
	gap: 0.5rem;
	overflow: hidden;
}

.name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-family: var(--theme--fonts--monospace--font-family);
}

.interface {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--theme--foreground-subdued);
	font-size: 12px;
}

.icons {
	display: flex;
	align-items: center;
	gap: 0.25rem;
}

.hidden-icon {
	--v-icon-color: var(--theme--warning);
}

.field.hidden {
	--theme--background: var(--theme--background-subdued);
	--v-input-color: var(--theme--foreground-subdued);
}
</style>
