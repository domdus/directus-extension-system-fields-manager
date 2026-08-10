<template>
	<layouts-view
		collection="directus_files"
		title="Files"
		icon="folder"
		intro-text="Configure field order, visibility, and width on Files item forms for matched roles or policies. Include File Preview as a virtual row to hide or reposition the preview chrome."
		about-text="Layouts apply to non-admin users (including custom fields on Files). File Preview is enforced in the browser because it is not a real field. Admins always see the default Studio layout."
	/>
</template>

<script setup lang="ts">
import LayoutsView from './layouts-view.vue';
</script>
