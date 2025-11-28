<script setup lang="ts">
defineProps<{
  label?: string;
  description?: string;
  error?: string;
  horizontal?: boolean;
}>();
</script>

<template>
  <div class="form-item" :class="{ 'is-horizontal': horizontal, 'has-error': !!error }">
    <div v-if="label" class="form-item-label" :title="horizontal ? description : undefined">
      {{ label }}
    </div>

    <div class="form-item-control">
      <slot />
    </div>

    <small v-if="description" class="form-item-description">{{ description }}</small>
    <small v-if="error" class="form-item-error">{{ error }}</small>
  </div>
</template>
