<script setup lang="ts">
import { useApiStore } from '../../stores/api.store';
import { chat_completion_sources } from '../../types';

const apiStore = useApiStore();
</script>

<template>
  <div class="api-connections-drawer">
    <div class="api-connections-drawer__wrapper">
      <!-- TODO: Implement Connection Profiles -->
      <div class="api-connections-drawer__section">
        <h3>{{ $t('apiConnections.profile') }}</h3>
        <p>{{ $t('apiConnections.profileNotImplemented') }}</p>
      </div>

      <hr />

      <div class="api-connections-drawer__section">
        <h3>{{ $t('apiConnections.api') }}</h3>
        <select class="text-pole" v-model="apiStore.mainApi">
          <option value="openai">{{ $t('apiConnections.chatCompletion') }}</option>
          <option value="textgenerationwebui" disabled>{{ $t('apiConnections.textCompletion') }}</option>
          <option value="novel" disabled>{{ $t('apiConnections.novel') }}</option>
          <option value="koboldhorde" disabled>{{ $t('apiConnections.horde') }}</option>
          <option value="kobold" disabled>{{ $t('apiConnections.kobold') }}</option>
        </select>
      </div>

      <div v-if="apiStore.mainApi === 'openai'">
        <div class="api-connections-drawer__section">
          <h4>{{ $t('apiConnections.source') }}</h4>
          <select class="text-pole" v-model="apiStore.oaiSettings.chat_completion_source">
            <optgroup>
              <option :value="chat_completion_sources.OPENAI">{{ $t('apiConnections.sources.openai') }}</option>
              <option :value="chat_completion_sources.CLAUDE">{{ $t('apiConnections.sources.claude') }}</option>
              <option :value="chat_completion_sources.OPENROUTER">{{ $t('apiConnections.sources.openrouter') }}</option>
              <!-- Add other sources as they are implemented -->
            </optgroup>
          </select>
        </div>

        <!-- OpenAI Form -->
        <form v-if="apiStore.oaiSettings.chat_completion_source === chat_completion_sources.OPENAI">
          <div class="api-connections-drawer__section">
            <h4>{{ $t('apiConnections.openaiKey') }}</h4>
            <div class="u-flex u-items-center">
              <!-- TODO: Add secret management -->
              <!-- <input
                type="password"
                class="text-pole u-w-full"
                autocomplete="off"
                :placeholder="$t('apiConnections.openaiKeyPlaceholder')"
                v-model="apiStore.oaiSettings.api_key_openai"
              /> -->
              <div class="menu-button fa-solid fa-key fa-fw" :title="$t('apiConnections.manageKeys')"></div>
            </div>
            <div class="neutral_warning">
              {{ $t('apiConnections.keyPrivacy') }}
            </div>
          </div>
          <div class="api-connections-drawer__section">
            <h4>{{ $t('apiConnections.openaiModel') }}</h4>
            <!-- This list is a static example. A real implementation would fetch it. -->
            <select class="text-pole" v-model="apiStore.oaiSettings.openai_model">
              <optgroup :label="$t('apiConnections.modelGroups.gpt4o')">
                <option value="gpt-4o">gpt-4o</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
              </optgroup>
              <optgroup :label="$t('apiConnections.modelGroups.gpt4turbo')">
                <option value="gpt-4-turbo">gpt-4-turbo</option>
              </optgroup>
            </select>
          </div>
        </form>

        <!-- Claude Form (placeholder) -->
        <form v-if="apiStore.oaiSettings.chat_completion_source === chat_completion_sources.CLAUDE">
          <div class="api-connections-drawer__section">
            <h4>{{ $t('apiConnections.claudeKey') }}</h4>
            <div class="u-flex u-items-center">
              <!-- TODO: Add secret management -->
              <!-- <input
                type="password"
                class="text-pole u-w-full"
                autocomplete="off"
                :placeholder="$t('apiConnections.claudeKeyPlaceholder')"
                v-model="apiStore.oaiSettings.api_key_claude"
              /> -->
              <div class="menu-button fa-solid fa-key fa-fw" :title="$t('apiConnections.manageKeys')"></div>
            </div>
            <div class="neutral_warning">
              {{ $t('apiConnections.keyPrivacy') }}
            </div>
          </div>
          <div class="api-connections-drawer__section">
            <h4>{{ $t('apiConnections.claudeModel') }}</h4>
            <select class="text-pole" v-model="apiStore.oaiSettings.claude_model">
              <option value="claude-3-5-sonnet-20240620">claude-3-5-sonnet-20240620</option>
              <option value="claude-3-opus-20240229">claude-3-opus-20240229</option>
              <option value="claude-3-haiku-20240307">claude-3-haiku-20240307</option>
            </select>
          </div>
        </form>

        <!-- OpenRouter Form -->
        <form v-if="apiStore.oaiSettings.chat_completion_source === chat_completion_sources.OPENROUTER">
          <div class="api-connections-drawer__section">
            <h4>{{ $t('apiConnections.openrouterKey') }}</h4>
            <div class="u-flex u-items-center">
              <!-- TODO: Add secret management -->
              <!-- <input
                type="password"
                class="text-pole u-w-full"
                autocomplete="off"
                :placeholder="$t('apiConnections.openrouterKeyPlaceholder')"
                v-model="apiStore.oaiSettings.api_key_openrouter"
              /> -->
              <div class="menu-button fa-solid fa-key fa-fw" :title="$t('apiConnections.manageKeys')"></div>
            </div>
            <div class="neutral_warning">
              {{ $t('apiConnections.keyPrivacy') }}
            </div>
          </div>
          <div class="api-connections-drawer__section">
            <h4>{{ $t('apiConnections.openrouterModel') }}</h4>
            <input
              type="text"
              class="text-pole u-w-full"
              placeholder="google/gemini-pro-1.5"
              v-model="apiStore.oaiSettings.openrouter_model"
            />
          </div>
        </form>

        <!-- TODO: Add forms for other sources -->

        <div class="api-connections-drawer__section">
          <div class="u-flex u-items-center" style="margin-top: 15px">
            <button
              @click.prevent="apiStore.connect"
              class="menu-button"
              :disabled="apiStore.isConnecting"
              :class="{ disabled: apiStore.isConnecting }"
            >
              <i v-if="apiStore.isConnecting" class="fa-solid fa-spinner fa-spin"></i>
              <span v-else>{{
                apiStore.isConnecting ? $t('apiConnections.connecting') : $t('apiConnections.connect')
              }}</span>
            </button>
          </div>
          <div class="online_status">
            <div
              class="online_status_indicator"
              :class="{ success: apiStore.onlineStatus === 'Valid' || apiStore.onlineStatus.includes('bypassed') }"
            ></div>
            <div class="online_status_text">{{ apiStore.onlineStatus }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
