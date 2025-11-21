<script setup lang="ts">
defineProps<{
  label?: string;
  description?: string;
  error?: string;
  horizontal?: boolean;
}>();
</script>

<template>
  <div class="app-form-item" :class="{ 'is-horizontal': horizontal, 'has-error': !!error }">
    <div v-if="label" class="app-form-item-label">
      {{ label }}
    </div>

    <div class="app-form-item-control">
      <slot />
    </div>

    <small v-if="description" class="app-form-item-description">{{ description }}</small>
    <small v-if="error" class="app-form-item-error">{{ error }}</small>
  </div>
</template>
