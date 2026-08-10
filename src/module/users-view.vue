<template>
	<layouts-view
		collection="directus_users"
		title="Users"
		icon="people_alt"
		intro-text="Configure field order, visibility, and width on Users item forms for matched roles or policies. First matching layout wins; empty roles and policies = catch-all."
		about-text="Layouts apply to non-admin users (including custom fields on Users). This only changes Studio form layout — not API field permissions. Admins always see the default Studio layout."
	/>
</template>

<script setup lang="ts">
import LayoutsView from './layouts-view.vue';
</script>
