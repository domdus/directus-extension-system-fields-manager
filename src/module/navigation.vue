<template>
	<v-list nav>
		<v-list-item to="/system-fields-manager/users">
			<v-list-item-icon>
				<v-icon name="people_alt" />
			</v-list-item-icon>
			<v-list-item-content>
				<v-text-overflow text="Users" />
			</v-list-item-content>
		</v-list-item>

		<v-list-item to="/system-fields-manager/files">
			<v-list-item-icon>
				<v-icon name="folder" />
			</v-list-item-icon>
			<v-list-item-content>
				<v-text-overflow text="Files" />
			</v-list-item-content>
		</v-list-item>

		<v-divider />

		<v-list-item to="/system-fields-manager/settings">
			<v-list-item-icon>
				<v-icon name="settings" />
			</v-list-item-icon>
			<v-list-item-content>
				<v-text-overflow text="Settings" />
			</v-list-item-content>
		</v-list-item>
	</v-list>
</template>

<script setup lang="ts">
// Navigation for System Fields Manager views
</script>
