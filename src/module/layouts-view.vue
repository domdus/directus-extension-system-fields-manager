<template>
	<private-view :title="title" :icon="icon">
		<template #headline>
			<v-breadcrumb :items="[{ name: 'System Fields', to: '/system-fields/files' }]" />
		</template>

		<template #navigation>
			<module-navigation />
		</template>

		<template #actions>
			<v-button v-tooltip.bottom="'Save'" :disabled="!hasEdits" :loading="saving" icon rounded @click="save">
				<v-icon name="check" />
			</v-button>
		</template>

		<template #sidebar>
			<sidebar-detail icon="info" title="About" close>
				<p class="sidebar-text">{{ aboutText }}</p>
			</sidebar-detail>
		</template>

		<div :class="pageClass">
			<div v-if="loading" class="loading">
				<v-progress-circular indeterminate />
			</div>

			<template v-else>
				<v-divider
					class="section-divider"
					large
					:style="{ '--v-divider-color': 'var(--theme--border-color-subdued)' }"
				>
					<template #icon><v-icon :name="icon" /></template>
					{{ title }}
				</v-divider>
				<p class="page-intro">{{ introText }}</p>

				<draggable v-model="layouts" item-key="id" handle=".drag-handle" :animation="150" class="list">
					<template #item="{ element }">
						<v-list-item block dense clickable class="layout-row" @click="openLayoutEditor(collection, element.id)">
							<v-icon class="drag-handle" name="drag_handle" @click.stop />
							<v-icon class="icon" name="tune" />
							<div class="info">
								<div class="name">Layout</div>
								<div class="meta">{{ layoutSummary(element) }}</div>
							</div>
							<div class="row-actions" @click.stop>
								<v-button
									v-tooltip="'Edit layout'"
									icon
									x-small
									secondary
									@click="openLayoutEditor(collection, element.id)"
								>
									<v-icon name="edit" />
								</v-button>
								<v-button icon x-small secondary @click="removeLayout(collection, element.id)">
									<v-icon name="close" />
								</v-button>
							</div>
						</v-list-item>
					</template>
				</draggable>

				<v-button class="add-layout" @click="addLayout(collection)">Add Layout</v-button>
			</template>
		</div>

		<v-drawer
			:model-value="isEditingThis"
			:title="`${title} Layout`"
			icon="tune"
			@update:model-value="onLayoutDrawerToggle"
			@cancel="closeLayoutEditor"
		>
			<template #actions>
				<v-button v-tooltip.bottom="'Apply'" icon rounded @click="saveLayoutDraft">
					<v-icon name="check" />
				</v-button>
			</template>

			<div v-if="layoutDraft && isEditingThis" class="drawer-content">
				<p class="hint">
					First matching layout wins. Leave roles and policies empty for a catch-all (place it last). Admins are
					never affected. This only changes Studio form layout — not API field permissions.
				</p>

				<div class="field">
					<label>Roles</label>
					<v-select
						v-model="layoutDraft.roles"
						multiple
						:items="roleOptions"
						item-text="text"
						item-value="value"
						placeholder="Select roles (optional)"
					/>
				</div>

				<div class="field">
					<label>Policies</label>
					<v-select
						v-model="layoutDraft.policies"
						multiple
						:items="policyOptions"
						item-text="text"
						item-value="value"
						placeholder="Select policies (optional)"
					/>
				</div>

				<div class="fields-header">
					<label>Fields</label>
					<v-button x-small secondary @click="resetDraftFieldsToDefaults">Reset to defaults</v-button>
				</div>

				<draggable
					v-model="layoutDraft.fields"
					item-key="field"
					handle=".drag-handle"
					:animation="150"
					class="field-grid"
				>
					<template #item="{ element }">
						<field-layout-row
							:entry="element"
							:label="fieldLabel(element.field)"
							@toggle-show="setDraftFieldShow(element.field, element.show === false)"
							@set-width="setDraftFieldWidth(element.field, $event)"
						/>
					</template>
				</draggable>
			</div>
		</v-drawer>
	</private-view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import draggable from 'vuedraggable';
import { usePageClass } from './composables/use-page-class';
import { useSystemFields, type SupportedCollection } from './composables/use-system-fields';
import FieldLayoutRow from './field-layout-row.vue';
import ModuleNavigation from './navigation.vue';

const props = defineProps<{
	collection: SupportedCollection;
	title: string;
	icon: string;
	introText: string;
	aboutText: string;
}>();

const pageClass = usePageClass();

const {
	loading,
	saving,
	hasEdits,
	roleOptions,
	policyOptions,
	layoutEditing,
	layoutDraft,
	layoutsFor,
	layoutSummary,
	fieldLabel,
	addLayout,
	removeLayout,
	openLayoutEditor,
	closeLayoutEditor,
	onLayoutDrawerToggle,
	saveLayoutDraft,
	setDraftFieldShow,
	setDraftFieldWidth,
	resetDraftFieldsToDefaults,
	ensureLoaded,
	save,
} = useSystemFields();

const layouts = layoutsFor(props.collection);

const isEditingThis = computed(
	() => layoutEditing.value?.collection === props.collection && layoutEditing.value !== null,
);

onMounted(() => {
	ensureLoaded();
});
</script>

<style scoped>
.page {
	padding: var(--content-padding);
	padding-block-end: var(--content-padding-bottom);
	max-width: 720px;
}

.page--flush-top {
	padding-block-start: 0;
}

.section-divider {
	margin-bottom: 12px;
}

.page-intro,
.sidebar-text,
.hint {
	margin: 0 0 24px;
	line-height: 1.55;
	color: var(--theme--foreground);
}

.loading {
	display: flex;
	justify-content: center;
	padding: 48px 0;
}

.list {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.layout-row {
	display: flex;
	align-items: center;
	gap: 12px;
}

.layout-row .icon {
	flex-shrink: 0;
}

.drag-handle {
	cursor: grab;
	color: var(--theme--foreground-subdued);
}

.info {
	flex: 1;
	min-width: 0;
}

.name {
	font-weight: 600;
}

.meta {
	font-size: 12px;
	color: var(--theme--foreground-subdued);
}

.row-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}

.add-layout {
	margin-top: 16px;
}

.drawer-content {
	padding: var(--content-padding);
}

.drawer-content .field {
	margin-bottom: 20px;
}

.drawer-content label {
	display: block;
	margin-bottom: 8px;
	font-weight: 600;
}

.fields-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 8px 0 12px;
}

.fields-header label {
	margin: 0;
	font-weight: 600;
}

.field-grid {
	position: relative;
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	padding-block-end: 0.5rem;
}
</style>
