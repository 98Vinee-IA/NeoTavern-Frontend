import { ref, computed } from 'vue';
import { get, debounce } from 'lodash-es';
import { type Character } from '../types';
import { ApiTokenizer } from '../api/tokenizer';
import { useSettingsStore } from '../stores/settings.store';
import { useStrictI18n } from './useStrictI18n';
import { toast } from './useToast';
import { DebounceTimeout } from '../constants';

export function useCharacterTokens() {
  const { t } = useStrictI18n();

  const tokenCounts = ref<{ total: number; permanent: number; fields: Record<string, number> }>({
    total: 0,
    permanent: 0,
    fields: {},
  });

  const totalTokens = computed(() => tokenCounts.value.total);
  const permanentTokens = computed(() => tokenCounts.value.permanent);

  const calculateAllTokens = debounce(async (characterData: Partial<Character>) => {
    if (!characterData) {
      tokenCounts.value = { total: 0, permanent: 0, fields: {} };
      return;
    }

    const fieldPaths = [
      'description',
      'first_mes',
      'personality',
      'scenario',
      'mes_example',
      'data.system_prompt',
      'data.post_history_instructions',
      'data.depth_prompt.prompt',
    ];

    const tokenizer = ApiTokenizer.default;
    const newFieldCounts: Record<string, number> = {};
    const promises = fieldPaths.map((path) =>
      tokenizer.getTokenCount(get(characterData, path)).then((count) => {
        newFieldCounts[path] = count;
      }),
    );

    await Promise.all(promises);

    const total = Object.values(newFieldCounts).reduce((sum, count) => sum + count, 0);

    tokenCounts.value = {
      total: total,
      permanent: total, // TODO: Refine permanent token logic
      fields: newFieldCounts,
    };

    const settingsStore = useSettingsStore();
    const maxContext = settingsStore.settings.api.samplers.max_context;
    const warningThreshold = maxContext * 0.75;

    if (total > warningThreshold) {
      toast.warning(t('character.tokenWarning', { tokens: total, percentage: 75 }), undefined, { timeout: 8000 });
    }
  }, DebounceTimeout.RELAXED);

  return {
    tokenCounts,
    totalTokens,
    permanentTokens,
    calculateAllTokens,
  };
}
