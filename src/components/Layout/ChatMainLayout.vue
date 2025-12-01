<script setup lang="ts">
import { useUiStore } from '../../stores/ui.store';
import ChatHeader from '../Chat/ChatHeader.vue';
import ChatInterface from '../Chat/ChatInterface.vue';
import ZoomedAvatar from '../ZoomedAvatar.vue';

const uiStore = useUiStore();
</script>

<template>
  <ChatHeader />
  <div class="content-wrapper">
    <ChatInterface />
  </div>
  <template v-for="avatar in uiStore.zoomedAvatars" :key="avatar.id">
    <ZoomedAvatar :avatar="avatar" />
  </template>
</template>
