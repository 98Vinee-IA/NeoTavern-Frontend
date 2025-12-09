<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts" generic="T extends string | number">
import { autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/vue';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useMobile } from '../../composables/useMobile';
import Icon from './Icon.vue';

export interface Option<T> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface Group<T> {
  label: string;
  options: Option<T>[];
}

export type SelectItem<T> = Option<T> | Group<T>;

interface Props {
  modelValue: T | T[];
  options: SelectItem<T>[];
  label?: string;
  disabled?: boolean;
  title?: string;
  multiple?: boolean;
  placeholder?: string;
  searchable?: boolean;
  groupSelect?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  disabled: false,
  label: undefined,
  title: undefined,
  placeholder: 'Select...',
  searchable: false,
  groupSelect: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: T | T[]): void;
  (e: 'change', value: T | T[]): void;
}>();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const { isMobile } = useMobile();

const { floatingStyles } = useFloating(triggerRef, dropdownRef, {
  placement: 'bottom-start',
  open: isOpen,
  whileElementsMounted: autoUpdate,
  middleware: [
    offset(4),
    flip({ padding: 10 }),
    shift({ padding: 10 }),
    size({
      apply({ rects, elements }) {
        Object.assign(elements.floating.style, {
          width: `${rects.reference.width}px`,
        });
      },
    }),
  ],
});

function toggleOpen() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;

  if (isOpen.value) {
    nextTick(() => {
      scrollToSelectedOption();
      if (props.searchable && !isMobile.value) {
        searchInputRef.value?.focus();
      }
    });
  } else {
    // Reset search on close
    searchQuery.value = '';
  }
}

function scrollToSelectedOption() {
  if (!dropdownRef.value) return;

  const selectedElement = dropdownRef.value.querySelector('.select-option.is-selected');
  if (selectedElement) {
    selectedElement.scrollIntoView({
      block: 'center',
      inline: 'center',
    });
  }
}

function close() {
  isOpen.value = false;
  searchQuery.value = '';
}

function isGroup(item: SelectItem<T>): item is Group<T> {
  return 'options' in item;
}

function isSelected(value: T): boolean {
  if (props.multiple && Array.isArray(props.modelValue)) {
    return props.modelValue.includes(value);
  }
  return props.modelValue === value;
}

function isGroupSelected(group: Group<T>): boolean {
  if (!props.multiple || !props.groupSelect || !Array.isArray(props.modelValue)) return false;

  const enabledOptions = group.options.filter((opt) => !opt.disabled);
  if (enabledOptions.length === 0) return false;

  const values = props.modelValue as T[];
  return enabledOptions.every((opt) => values.includes(opt.value));
}

function isGroupPartiallySelected(group: Group<T>): boolean {
  if (!props.multiple || !props.groupSelect || !Array.isArray(props.modelValue)) return false;

  const enabledOptions = group.options.filter((opt) => !opt.disabled);
  if (enabledOptions.length === 0) return false;

  const values = props.modelValue as T[];
  const selectedCount = enabledOptions.filter((opt) => values.includes(opt.value)).length;
  return selectedCount > 0 && selectedCount < enabledOptions.length;
}

function toggleGroup(group: Group<T>) {
  if (!props.multiple || !props.groupSelect) return;

  const enabledOptions = group.options.filter((opt) => !opt.disabled);
  if (enabledOptions.length === 0) return;

  const currentValues = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
  const allSelected = enabledOptions.every((opt) => currentValues.includes(opt.value));

  let newValues: T[];

  if (allSelected) {
    // Deselect all
    const valuesToRemove = enabledOptions.map((opt) => opt.value);
    newValues = currentValues.filter((val) => !valuesToRemove.includes(val));
  } else {
    // Select all (union)
    newValues = [...currentValues];
    enabledOptions.forEach((opt) => {
      if (!newValues.includes(opt.value)) {
        newValues.push(opt.value);
      }
    });
  }

  emit('update:modelValue', newValues);
  emit('change', newValues);
}

function selectOption(option: Option<T>) {
  if (option.disabled) return;

  if (props.multiple) {
    const currentValues = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
    const index = currentValues.indexOf(option.value);

    if (index === -1) {
      currentValues.push(option.value);
    } else {
      currentValues.splice(index, 1);
    }

    emit('update:modelValue', currentValues);
    emit('change', currentValues);
    // Keep open for multiple selection
  } else {
    emit('update:modelValue', option.value);
    emit('change', option.value);
    close();
  }
}

// Used for Display Value lookup (always looks at all props, ignores search)
const flatOptions = computed(() => {
  const flat: Option<T>[] = [];
  for (const item of props.options) {
    if (isGroup(item)) {
      flat.push(...item.options);
    } else {
      flat.push(item);
    }
  }
  return flat;
});

// Used for rendering the dropdown list (filters based on search)
const filteredOptions = computed(() => {
  if (!props.searchable || !searchQuery.value.trim()) {
    return props.options;
  }

  const query = searchQuery.value.toLowerCase().trim();
  const result: SelectItem<T>[] = [];

  for (const item of props.options) {
    if (isGroup(item)) {
      // Filter options within the group
      const matchingChildren = item.options.filter((opt) => opt.label.toLowerCase().includes(query));
      if (matchingChildren.length > 0) {
        // Return a new group object with only matching children
        result.push({
          ...item,
          options: matchingChildren,
        });
      }
    } else {
      // Check individual option
      if (item.label.toLowerCase().includes(query)) {
        result.push(item);
      }
    }
  }

  return result;
});

const displayValue = computed(() => {
  if (props.multiple && Array.isArray(props.modelValue)) {
    if (props.modelValue.length === 0) return props.placeholder;

    const selectedLabels = props.modelValue
      .map((val) => flatOptions.value.find((opt) => opt.value === val)?.label)
      .filter(Boolean);

    if (selectedLabels.length === 0) return props.placeholder;
    return selectedLabels.join(', ');
  }

  const selectedOption = flatOptions.value.find((opt) => opt.value === props.modelValue);
  return selectedOption ? selectedOption.label : props.placeholder;
});

function onClickOutside(event: MouseEvent) {
  const target = event.target as Node;

  const isOutsideContainer = containerRef.value && !containerRef.value.contains(target);
  const isOutsideDropdown = dropdownRef.value && !dropdownRef.value.contains(target);

  if (isOutsideContainer && isOutsideDropdown) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside);
});

// Close if disabled changes to true
watch(
  () => props.disabled,
  (newVal) => {
    if (newVal) close();
  },
);
</script>

<template>
  <div ref="containerRef" class="select-wrapper">
    <label v-if="label" class="select-label">{{ label }}</label>

    <div
      ref="triggerRef"
      class="select-trigger text-pole"
      :class="{ 'is-open': isOpen, 'is-disabled': disabled }"
      :title="title"
      @click="toggleOpen"
    >
      <div class="selected-text">{{ displayValue }}</div>
      <Icon icon="fa-chevron-down" class="chevron-icon" :class="{ 'rotate-180': isOpen }" />
    </div>

    <Transition name="fade-fast">
      <div v-if="isOpen" ref="dropdownRef" class="select-dropdown" :style="floatingStyles">
        <!-- Search Input -->
        <div v-show="searchable" class="select-search-container" @click.stop>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="select-search-input"
            :placeholder="placeholder || 'Search...'"
          />
          <Icon icon="fa-magnifying-glass" class="select-search-icon" />
        </div>

        <template v-for="(item, index) in filteredOptions" :key="index">
          <!-- Group -->
          <div v-if="isGroup(item)" class="select-group">
            <div
              v-if="item.label"
              class="select-group-label"
              :class="{ 'is-interactive': multiple && groupSelect }"
              @click.stop="toggleGroup(item)"
            >
              <div v-if="multiple && groupSelect" class="option-checkbox">
                <Icon v-if="isGroupSelected(item)" icon="fa-check" class="check-icon" />
                <Icon
                  v-else-if="isGroupPartiallySelected(item)"
                  icon="fa-minus"
                  class="check-icon"
                  style="font-size: 0.7em"
                />
              </div>
              <span class="group-label-text">{{ item.label }}</span>
            </div>
            <div
              v-for="opt in item.options"
              :key="String(opt.value)"
              class="select-option is-nested"
              :class="{
                'is-selected': isSelected(opt.value),
                'is-disabled': opt.disabled,
              }"
              @click.stop="selectOption(opt)"
            >
              <div v-if="multiple" class="option-checkbox">
                <Icon v-if="isSelected(opt.value)" icon="fa-check" class="check-icon" />
              </div>
              <span class="option-label">{{ opt.label }}</span>
              <Icon v-if="!multiple && isSelected(opt.value)" icon="fa-check" class="check-icon-single" />
            </div>
          </div>

          <!-- Single Option -->
          <div
            v-else
            class="select-option"
            :class="{
              'is-selected': isSelected(item.value),
              'is-disabled': item.disabled,
            }"
            @click.stop="selectOption(item)"
          >
            <div v-if="multiple" class="option-checkbox">
              <Icon v-if="isSelected(item.value)" icon="fa-check" class="check-icon" />
            </div>
            <span class="option-label">{{ item.label }}</span>
            <Icon v-if="!multiple && isSelected(item.value)" icon="fa-check" class="check-icon-single" />
          </div>
        </template>

        <div v-if="filteredOptions.length === 0" class="select-option is-disabled">No options found</div>
      </div>
    </Transition>
  </div>
</template>
