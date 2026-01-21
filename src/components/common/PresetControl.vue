<script setup lang="ts">
import { computed } from 'vue';
import { useStrictI18n } from '../../composables/useStrictI18n';
import type { I18nKey } from '../../types/i18n';
import { Button, Select } from '../UI';

export interface CustomAction {
  key: string;
  icon: string;
  title: I18nKey;
  event: string;
  variant?: 'ghost' | 'danger';
}

type InternalAction = CustomAction & { visible?: boolean };

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    options?: { label: string; value: string | number }[];
    searchable?: boolean;
    disabled?: boolean;
    loading?: boolean;

    // Tooltips
    createTitle?: I18nKey;
    editTitle?: I18nKey;
    deleteTitle?: I18nKey;
    importTitle?: I18nKey;
    exportTitle?: I18nKey;
    saveTitle?: I18nKey;

    // Visibility
    allowCreate?: boolean;
    allowEdit?: boolean;
    allowDelete?: boolean;
    allowImport?: boolean;
    allowExport?: boolean;
    allowSave?: boolean;

    deleteVariant?: 'ghost' | 'danger';

    // Customization
    customActions?: CustomAction[];
    actionOrder?: string[];
  }>(),
  {
    deleteVariant: 'ghost',
    customActions: () => [],
    actionOrder: () => ['save', 'create', 'edit', 'delete', 'import', 'export'],
    modelValue: undefined,
    options: undefined,
    createTitle: undefined,
    editTitle: undefined,
    deleteTitle: undefined,
    importTitle: undefined,
    exportTitle: undefined,
    saveTitle: undefined,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
  (e: 'create'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'import'): void;
  (e: 'export'): void;
  (e: 'save'): void;
  (e: 'view'): void;
}>();

const internalValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val!),
});

const sortedOptions = computed(() => {
  if (!props.options) return [];
  return [...props.options].sort((a, b) => a.label.localeCompare(b.label));
});

const { t } = useStrictI18n();

const defaultActions = computed<InternalAction[]>(() => [
  {
    key: 'save',
    icon: 'fa-save',
    title: props.saveTitle ?? ('common.save' satisfies I18nKey),
    event: 'save',
    variant: 'ghost',
    visible: props.allowSave,
  },
  {
    key: 'create',
    icon: 'fa-file-circle-plus',
    title: props.createTitle ?? ('common.create' satisfies I18nKey),
    event: 'create',
    variant: 'ghost',
    visible: props.allowCreate,
  },
  {
    key: 'edit',
    icon: 'fa-pencil',
    title: props.editTitle ?? ('common.edit' satisfies I18nKey),
    event: 'edit',
    variant: 'ghost',
    visible: props.allowEdit,
  },
  {
    key: 'delete',
    icon: 'fa-trash-can',
    title: props.deleteTitle ?? ('common.delete' satisfies I18nKey),
    event: 'delete',
    variant: props.deleteVariant,
    visible: props.allowDelete,
  },
  {
    key: 'import',
    icon: 'fa-file-import',
    title: props.importTitle ?? ('common.import' satisfies I18nKey),
    event: 'import',
    variant: 'ghost',
    visible: props.allowImport,
  },
  {
    key: 'export',
    icon: 'fa-file-export',
    title: props.exportTitle ?? ('common.export' satisfies I18nKey),
    event: 'export',
    variant: 'ghost',
    visible: props.allowExport,
  },
]);

const finalActions = computed<CustomAction[]>(() => {
  const allVisibleActions: InternalAction[] = [
    ...defaultActions.value.filter((a) => a.visible),
    ...props.customActions.map((a) => ({ ...a, visible: true })),
  ];

  const actionsMap = new Map(allVisibleActions.map((a) => [a.key, a]));
  const orderedActions = props.actionOrder.map((key) => actionsMap.get(key)).filter((a): a is InternalAction => !!a);
  const remainingActions = allVisibleActions.filter((a) => !props.actionOrder.includes(a.key));

  return [...orderedActions, ...remainingActions];
});
</script>

<template>
  <div class="preset-control">
    <div class="preset-control-selector">
      <slot name="selector">
        <Select
          v-if="options"
          v-model="internalValue!"
          :options="sortedOptions"
          :searchable="searchable"
          :disabled="disabled"
        />
      </slot>
    </div>

    <div class="preset-control-actions">
      <Button
        v-for="action in finalActions"
        :key="action.key"
        :variant="action.variant || 'ghost'"
        :icon="action.icon"
        :title="t(action.title satisfies I18nKey)"
        :disabled="disabled || loading"
        @click="emit(action.event as any)"
      />
      <slot name="actions" />
    </div>
  </div>
</template>
