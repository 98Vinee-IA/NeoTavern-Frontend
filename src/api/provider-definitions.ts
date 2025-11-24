import type { ChatCompletionPayload } from '../types';
import { api_providers } from '../types';
import type { BuildChatCompletionPayloadOptions } from '../types/generation';
import type { SamplerSettings } from '../types/settings';

/**
 * Defines how a setting maps to an API payload parameter.
 */
export interface ParamHandling {
  /**
   * The key to use in the final API payload.
   * If omitted, uses the key from SamplerSettings.
   */
  remoteKey?: keyof ChatCompletionPayload | string;

  /**
   * If defined, the value will be clamped to this minimum.
   */
  min?: number;

  /**
   * If defined, the value will be clamped to this maximum.
   */
  max?: number;

  /**
   * Optional transform function to modify the value before sending.
   * Useful for slicing arrays (stop sequences) or type conversion.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform?: (value: any, context: BuildChatCompletionPayloadOptions) => any;
}

/**
 * Configuration for a specific parameter.
 */
export interface ParamConfiguration {
  /**
   * Default handling for this parameter.
   * Use this only if there is global logic (like checking for valid seeds).
   * If set to `null`, the parameter is NOT sent by default unless a provider overrides it.
   */
  defaults?: ParamHandling | null;

  /**
   * Per-provider overrides.
   * Set to `null` to explicitly disable this parameter for a provider.
   */
  providers?: Partial<Record<string, ParamHandling | null>>;

  /**
   * Model-specific overrides.
   * These take precedence over provider overrides.
   */
  modelRules?: Array<{
    pattern: RegExp;
    rule: ParamHandling | null;
  }>;
}

/**
 * Function to inject custom logic into the payload.
 */
export type InjectionFunction = (
  payload: ChatCompletionPayload & Record<string, unknown>,
  context: BuildChatCompletionPayloadOptions,
) => void;

/**
 * Global model rule for logic that cannot be handled by simple parameter mapping.
 */
export interface ModelInjection {
  pattern: RegExp;
  inject: InjectionFunction;
}

// --- Capability Definitions ---

export interface ProviderCapability {
  supportsChat: boolean;
  supportsText: boolean;
}

export const PROVIDER_CAPABILITIES: Record<string, ProviderCapability> = {
  [api_providers.OPENROUTER]: { supportsChat: true, supportsText: true },
  [api_providers.OPENAI]: { supportsChat: true, supportsText: false },
  [api_providers.CLAUDE]: { supportsChat: true, supportsText: false },
  [api_providers.AI21]: { supportsChat: true, supportsText: false },
  [api_providers.MAKERSUITE]: { supportsChat: true, supportsText: false },
  [api_providers.VERTEXAI]: { supportsChat: true, supportsText: false },
  [api_providers.MISTRALAI]: { supportsChat: true, supportsText: false },
  [api_providers.CUSTOM]: { supportsChat: true, supportsText: false },
  [api_providers.COHERE]: { supportsChat: true, supportsText: false },
  [api_providers.PERPLEXITY]: { supportsChat: true, supportsText: false },
  [api_providers.GROQ]: { supportsChat: true, supportsText: false },
  [api_providers.ELECTRONHUB]: { supportsChat: true, supportsText: false },
  [api_providers.NANOGPT]: { supportsChat: true, supportsText: false },
  [api_providers.DEEPSEEK]: { supportsChat: true, supportsText: false },
  [api_providers.AIMLAPI]: { supportsChat: true, supportsText: false },
  [api_providers.XAI]: { supportsChat: true, supportsText: false },
  [api_providers.POLLINATIONS]: { supportsChat: true, supportsText: false },
  [api_providers.MOONSHOT]: { supportsChat: true, supportsText: false },
  [api_providers.FIREWORKS]: { supportsChat: true, supportsText: false },
  [api_providers.COMETAPI]: { supportsChat: true, supportsText: false },
  [api_providers.AZURE_OPENAI]: { supportsChat: true, supportsText: false },
  [api_providers.ZAI]: { supportsChat: true, supportsText: false },
};

// --- Helper Transforms ---

const googleStopTransform = (v: string[]) => v?.slice(0, 5).filter((x) => x.length >= 1 && x.length <= 16);
const cohereStopTransform = (v: string[]) => v?.slice(0, 5);
const zaiStopTransform = (v: string[]) => v?.slice(0, 1);

// --- Parameter Definitions ---

export const PARAMETER_DEFINITIONS: Partial<Record<keyof SamplerSettings, ParamConfiguration>> = {
  max_tokens: {
    providers: {
      [api_providers.POLLINATIONS]: null,
    },
    modelRules: [
      { pattern: /^(o1|o3|o4)/, rule: { remoteKey: 'max_completion_tokens' } },
      { pattern: /^gpt-5/, rule: { remoteKey: 'max_completion_tokens' } },
    ],
  },

  temperature: {
    modelRules: [{ pattern: /^(o1|o3|o4)/, rule: null }],
  },

  frequency_penalty: {
    providers: {
      [api_providers.COHERE]: { min: 0, max: 1 },
      [api_providers.ZAI]: null,
    },
    modelRules: [
      { pattern: /^(o1|o3|o4)/, rule: null },
      { pattern: /grok-3-mini/, rule: null },
      { pattern: /(grok-4|grok-code)/, rule: null },
      { pattern: /gpt-5(\.1)?/, rule: null },
    ],
  },

  presence_penalty: {
    providers: {
      [api_providers.COHERE]: { min: 0, max: 1 },
      [api_providers.ZAI]: null,
    },
    modelRules: [
      { pattern: /^(o1|o3|o4)/, rule: null },
      { pattern: /grok-3-mini/, rule: null },
      { pattern: /(grok-4|grok-code)/, rule: null },
      { pattern: /gpt-5(\.1)?/, rule: null },
    ],
  },

  top_p: {
    providers: {
      [api_providers.COHERE]: { min: 0.01, max: 0.99 },
      [api_providers.ZAI]: { transform: (v) => v || 0.01 },
      [api_providers.DEEPSEEK]: { transform: (v) => v || Number.EPSILON },
    },
    modelRules: [{ pattern: /^(o1|o3|o4)/, rule: null }],
  },

  top_k: {
    // Disabled by default (OpenAI doesn't support it)
    defaults: null,
    providers: {
      [api_providers.CLAUDE]: {},
      [api_providers.OPENROUTER]: {},
      [api_providers.MAKERSUITE]: {},
      [api_providers.VERTEXAI]: {},
      [api_providers.COHERE]: {},
      [api_providers.PERPLEXITY]: {},
      [api_providers.ELECTRONHUB]: {},
    },
  },

  top_a: {
    // Disabled by default (OpenAI doesn't support it)
    defaults: null,
    providers: {
      [api_providers.OPENROUTER]: {},
    },
  },

  min_p: {
    // Disabled by default (OpenAI doesn't support it)
    defaults: null,
    providers: {
      [api_providers.OPENROUTER]: {},
    },
  },

  repetition_penalty: {
    // Disabled by default (OpenAI doesn't support it)
    defaults: null,
    providers: {
      [api_providers.OPENROUTER]: {},
    },
  },

  seed: {
    defaults: {
      transform: (v) => (typeof v === 'number' && v >= 0 ? v : undefined),
    },
  },

  stop: {
    defaults: {
      transform: (v: string[]) => (v && v.length > 0 ? v : undefined),
    },
    providers: {
      [api_providers.COHERE]: { transform: cohereStopTransform },
      [api_providers.MAKERSUITE]: { transform: googleStopTransform },
      [api_providers.VERTEXAI]: { transform: googleStopTransform },
      [api_providers.PERPLEXITY]: null,
      [api_providers.ZAI]: { transform: zaiStopTransform },
    },
    modelRules: [
      { pattern: /^(o1|o3|o4)/, rule: null },
      { pattern: /(?=.*gpt)(?=.*vision)/, rule: null },
      { pattern: /grok-3-mini/, rule: null },
      { pattern: /grok-4(?!.*fast-non-reasoning)/, rule: null },
      { pattern: /^gpt-5/, rule: null },
    ],
  },

  n: {
    providers: {
      [api_providers.GROQ]: null,
      [api_providers.XAI]: null,
    },
    modelRules: [{ pattern: /^(o1|o3|o4)/, rule: null }],
  },
};

// --- Provider Injections ---

export const PROVIDER_INJECTIONS: Partial<Record<string, InjectionFunction>> = {
  [api_providers.CLAUDE]: (payload, { samplerSettings }) => {
    payload.claude_use_sysprompt = samplerSettings.providers.claude?.use_sysprompt;
    payload.assistant_prefill = samplerSettings.providers.claude?.assistant_prefill;
    payload.top_k = samplerSettings.top_k;
  },

  [api_providers.MISTRALAI]: (payload) => {
    payload.safe_prompt = false;
  },

  [api_providers.MAKERSUITE]: (payload, { samplerSettings }) => {
    payload.use_makersuite_sysprompt = samplerSettings.providers.google?.use_makersuite_sysprompt;
  },

  [api_providers.VERTEXAI]: (payload, { samplerSettings, providerSpecific }) => {
    payload.use_makersuite_sysprompt = samplerSettings.providers.google?.use_makersuite_sysprompt;
    if (providerSpecific?.vertexai) {
      payload.vertexai_auth_mode = providerSpecific.vertexai.auth_mode;
      payload.vertexai_region = providerSpecific.vertexai.region;
      payload.vertexai_express_project_id = providerSpecific.vertexai.express_project_id;
    }
  },

  [api_providers.OPENROUTER]: (payload, { providerSpecific }) => {
    payload.use_fallback = providerSpecific.openrouter.useFallback;
    payload.provider = providerSpecific.openrouter?.providers;
    payload.allow_fallbacks = providerSpecific.openrouter.allowFallbacks;
    payload.middleout = providerSpecific.openrouter.middleout;
  },

  [api_providers.CUSTOM]: (payload, { providerSpecific }) => {
    payload.custom_url = providerSpecific.custom?.url;
    payload.custom_include_body = providerSpecific.custom?.include_body;
    payload.custom_exclude_body = providerSpecific.custom?.exclude_body;
    payload.custom_include_headers = providerSpecific.custom?.include_headers;
  },

  [api_providers.AZURE_OPENAI]: (payload, { providerSpecific }) => {
    if (providerSpecific.azure_openai) {
      payload.azure_base_url = providerSpecific.azure_openai.baseUrl;
      payload.azure_deployment_name = providerSpecific.azure_openai.deploymentName;
      payload.azure_api_version = providerSpecific.azure_openai.apiVersion;
    }
  },

  [api_providers.ZAI]: (payload, { providerSpecific }) => {
    if (providerSpecific?.zai?.endpoint) {
      payload.zai_endpoint = providerSpecific.zai.endpoint;
    }
  },

  [api_providers.GROQ]: (payload) => {
    delete payload.logprobs;
    delete payload.logit_bias;
    delete payload.top_logprobs;
    delete payload.n;
  },
};

// --- Global Model Injections ---

export const MODEL_INJECTIONS: ModelInjection[] = [
  {
    // o1 / o3 / o4 reasoning models
    pattern: /^(o1|o3|o4)/,
    inject: (payload) => {
      if (payload.model?.startsWith('o1')) {
        payload.messages?.forEach((msg) => {
          if (msg.role === 'system') msg.role = 'user';
        });
      }
      // Clean up params not supported by O-series
      delete payload.n;
      delete payload.tools;
      delete payload.tool_choice;
      delete payload.logprobs;
      delete payload.top_logprobs;
    },
  },
  {
    // GPT-5 constraints
    pattern: /^gpt-5/,
    inject: (payload) => {
      // Common GPT-5 removals

      delete payload.logprobs;
      delete payload.top_logprobs;

      if (/chat-latest/.test(payload.model || '')) {
        // Strict exclusions for chat-latest

        delete payload.tools;
        delete payload.tool_choice;
      } else {
        // Exclusions for other GPT-5 variants
        delete payload.temperature;
        delete payload.top_p;
        delete payload.frequency_penalty;
        delete payload.presence_penalty;
        delete payload.stop;

        delete payload.logit_bias;
      }
    },
  },
  {
    // Grok-4 / Grok-Code constraints
    pattern: /(grok-4|grok-code)/,
    inject: (payload, { model }) => {
      if (!model.includes('grok-4-fast-non-reasoning')) {
        delete payload.stop;
      }
    },
  },
  {
    // Vision model constraints (GPT-4 Vision, etc.)
    pattern: /(?=.*gpt)(?=.*vision)/,
    inject: (payload) => {
      delete payload.logit_bias;
      delete payload.stop;
      delete payload.logprobs;
    },
  },
];
