import { OpenrouterMiddleoutType } from './constants';
import { api_providers, type AiConfigSection } from './types';

export const apiConnectionDefinition: AiConfigSection[] = [
  // OpenAI
  {
    id: 'openai',
    conditions: { provider: api_providers.OPENAI },
    items: [
      { widget: 'key-manager', label: 'apiConnections.openaiKey' },
      {
        id: 'api.selectedProviderModels.openai',
        widget: 'model-select',
        label: 'apiConnections.openaiModel',
      },
    ],
  },
  // Claude
  {
    id: 'claude',
    conditions: { provider: api_providers.CLAUDE },
    items: [
      { widget: 'key-manager', label: 'apiConnections.claudeKey' },
      {
        id: 'api.selectedProviderModels.claude',
        widget: 'select',
        label: 'apiConnections.claudeModel',
        options: [
          { label: 'claude-3-5-sonnet-20240620', value: 'claude-3-5-sonnet-20240620' },
          { label: 'claude-3-opus-20240229', value: 'claude-3-opus-20240229' },
          { label: 'claude-3-haiku-20240307', value: 'claude-3-haiku-20240307' },
        ],
      },
    ],
  },
  // OpenRouter
  {
    id: 'openrouter',
    conditions: { provider: api_providers.OPENROUTER },
    items: [
      { widget: 'key-manager', label: 'apiConnections.openrouterKey' },
      {
        id: 'api.selectedProviderModels.openrouter',
        widget: 'model-select',
        label: 'apiConnections.openrouterModel',
        placeholder: 'google/gemini-pro-1.5',
      },
      { widget: 'header', label: 'apiConnections.openrouterOptions' },
      {
        id: 'api.providerSpecific.openrouter.useFallback',
        widget: 'checkbox',
        label: 'apiConnections.openrouterUseFallback',
      },
      {
        id: 'api.providerSpecific.openrouter.allowFallbacks',
        widget: 'checkbox',
        label: 'apiConnections.openrouterAllowFallbacks',
      },
      {
        id: 'api.providerSpecific.openrouter.providers',
        widget: 'text-input',
        label: 'apiConnections.openrouterFallbackProviders',
        valueType: 'array',
        arraySeparator: ',',
      },
      {
        id: 'api.providerSpecific.openrouter.middleout',
        widget: 'select',
        label: 'apiConnections.openrouterMiddleout',
        options: [
          { label: 'apiConnections.middleout.on', value: OpenrouterMiddleoutType.ON },
          { label: 'apiConnections.middleout.off', value: OpenrouterMiddleoutType.OFF },
          { label: 'apiConnections.middleout.auto', value: OpenrouterMiddleoutType.AUTO },
        ],
      },
    ],
  },
  // Mistral
  {
    id: 'mistral',
    conditions: { provider: api_providers.MISTRALAI },
    items: [
      { widget: 'key-manager', label: 'apiConnections.mistralaiKey' },
      {
        id: 'api.selectedProviderModels.mistralai',
        widget: 'select',
        label: 'apiConnections.mistralaiModel',
        options: [
          { label: 'mistral-large-latest', value: 'mistral-large-latest' },
          { label: 'mistral-small-latest', value: 'mistral-small-latest' },
        ],
      },
    ],
  },
  // Groq
  {
    id: 'groq',
    conditions: { provider: api_providers.GROQ },
    items: [
      { widget: 'key-manager', label: 'apiConnections.groqKey' },
      {
        id: 'api.selectedProviderModels.groq',
        widget: 'select',
        label: 'apiConnections.groqModel',
        options: [
          { label: 'llama3-70b-8192', value: 'llama3-70b-8192' },
          { label: 'llama3-8b-8192', value: 'llama3-8b-8192' },
          { label: 'gemma-7b-it', value: 'gemma-7b-it' },
          { label: 'mixtral-8x7b-32768', value: 'mixtral-8x7b-32768' },
        ],
      },
    ],
  },
  // Custom
  {
    id: 'custom',
    conditions: { provider: api_providers.CUSTOM },
    items: [
      {
        id: 'api.providerSpecific.custom.url',
        widget: 'text-input',
        label: 'apiConnections.customUrl',
      },
      {
        id: 'api.selectedProviderModels.custom',
        widget: 'text-input',
        label: 'apiConnections.customModel',
      },
      { widget: 'key-manager', label: 'apiConnections.customKey' },
    ],
  },
  // Azure OpenAI
  {
    id: 'azure',
    conditions: { provider: api_providers.AZURE_OPENAI },
    items: [
      { widget: 'key-manager', label: 'apiConnections.azureKey' },
      {
        id: 'api.providerSpecific.azure_openai.baseUrl',
        widget: 'text-input',
        label: 'apiConnections.azureBaseUrl',
      },
      {
        id: 'api.providerSpecific.azure_openai.deploymentName',
        widget: 'text-input',
        label: 'apiConnections.azureDeploymentName',
      },
      {
        id: 'api.providerSpecific.azure_openai.apiVersion',
        widget: 'text-input',
        label: 'apiConnections.azureApiVersion',
      },
      {
        id: 'api.selectedProviderModels.azure_openai',
        widget: 'text-input',
        label: 'apiConnections.azureModel',
        placeholder: 'This is the model name inside your deployment',
      },
    ],
  },
  // Deepseek
  {
    id: 'deepseek',
    conditions: { provider: api_providers.DEEPSEEK },
    items: [
      { widget: 'key-manager', label: 'apiConnections.deepseekKey' },
      {
        id: 'api.selectedProviderModels.deepseek',
        widget: 'select',
        label: 'apiConnections.deepseekModel',
        options: [
          { label: 'deepseek-chat', value: 'deepseek-chat' },
          { label: 'deepseek-reasoner', value: 'deepseek-reasoner' },
        ],
      },
    ],
  },
  // AI21
  {
    id: 'ai21',
    conditions: { provider: api_providers.AI21 },
    items: [
      { widget: 'key-manager', label: 'apiConnections.ai21Key' },
      {
        id: 'api.selectedProviderModels.ai21',
        widget: 'text-input',
        label: 'apiConnections.ai21Model',
        placeholder: 'jamba-1.5-large',
      },
    ],
  },
  // Google (MakerSuite)
  {
    id: 'makersuite',
    conditions: { provider: api_providers.MAKERSUITE },
    items: [
      // TODO: Key manager might need to handle specific auth types for Google? Usually it's an API Key for MakerSuite.
      { widget: 'key-manager', label: 'apiConnections.googleKey' },
      {
        id: 'api.selectedProviderModels.makersuite',
        widget: 'text-input',
        label: 'apiConnections.googleModel',
        placeholder: 'gemini-2.0-flash',
      },
    ],
  },
  // VertexAI
  {
    id: 'vertexai',
    conditions: { provider: api_providers.VERTEXAI },
    items: [
      // Vertex AI typically uses ADC or JSON key file content. Using key-manager for now as placeholder for token/key.
      { widget: 'key-manager', label: 'apiConnections.vertexaiKey' },
      {
        id: 'api.selectedProviderModels.vertexai',
        widget: 'text-input',
        label: 'apiConnections.vertexaiModel',
        placeholder: 'gemini-2.0-flash',
      },
      {
        id: 'api.providerSpecific.vertexai.express_project_id',
        widget: 'text-input',
        label: 'apiConnections.vertexaiProjectId',
      },
      {
        id: 'api.providerSpecific.vertexai.region',
        widget: 'text-input',
        label: 'apiConnections.vertexaiRegion',
        placeholder: 'us-central1',
      },
    ],
  },
  // Cohere
  {
    id: 'cohere',
    conditions: { provider: api_providers.COHERE },
    items: [
      { widget: 'key-manager', label: 'apiConnections.cohereKey' },
      {
        id: 'api.selectedProviderModels.cohere',
        widget: 'text-input',
        label: 'apiConnections.cohereModel',
        placeholder: 'command-r-plus',
      },
    ],
  },
  // Perplexity
  {
    id: 'perplexity',
    conditions: { provider: api_providers.PERPLEXITY },
    items: [
      { widget: 'key-manager', label: 'apiConnections.perplexityKey' },
      {
        id: 'api.selectedProviderModels.perplexity',
        widget: 'text-input',
        label: 'apiConnections.perplexityModel',
        placeholder: 'llama-3-70b-instruct',
      },
    ],
  },
  // ElectronHub
  {
    id: 'electronhub',
    conditions: { provider: api_providers.ELECTRONHUB },
    items: [
      { widget: 'key-manager', label: 'apiConnections.electronhubKey' },
      {
        id: 'api.selectedProviderModels.electronhub',
        widget: 'text-input',
        label: 'apiConnections.electronhubModel',
        placeholder: 'gpt-4o-mini',
      },
    ],
  },
  // NanoGPT
  {
    id: 'nanogpt',
    conditions: { provider: api_providers.NANOGPT },
    items: [
      { widget: 'key-manager', label: 'apiConnections.nanogptKey' },
      {
        id: 'api.selectedProviderModels.nanogpt',
        widget: 'text-input',
        label: 'apiConnections.nanogptModel',
        placeholder: 'gpt-4o-mini',
      },
    ],
  },
  // AIMLAPI
  {
    id: 'aimlapi',
    conditions: { provider: api_providers.AIMLAPI },
    items: [
      { widget: 'key-manager', label: 'apiConnections.aimlapiKey' },
      {
        id: 'api.selectedProviderModels.aimlapi',
        widget: 'text-input',
        label: 'apiConnections.aimlapiModel',
        placeholder: 'gpt-4o-mini-2024-07-18',
      },
    ],
  },
  // XAI
  {
    id: 'xai',
    conditions: { provider: api_providers.XAI },
    items: [
      { widget: 'key-manager', label: 'apiConnections.xapiKey' },
      {
        id: 'api.selectedProviderModels.xai',
        widget: 'text-input',
        label: 'apiConnections.xaiModel',
        placeholder: 'grok-3-beta',
      },
    ],
  },
  // Pollinations
  {
    id: 'pollinations',
    conditions: { provider: api_providers.POLLINATIONS },
    items: [
      // Pollinations might not need a key, but putting it just in case or leaving it out if usually free/no-auth?
      // Assuming it acts like others for now.
      {
        id: 'api.selectedProviderModels.pollinations',
        widget: 'text-input',
        label: 'apiConnections.pollinationsModel',
        placeholder: 'openai',
      },
    ],
  },
  // Moonshot
  {
    id: 'moonshot',
    conditions: { provider: api_providers.MOONSHOT },
    items: [
      { widget: 'key-manager', label: 'apiConnections.moonshotKey' },
      {
        id: 'api.selectedProviderModels.moonshot',
        widget: 'text-input',
        label: 'apiConnections.moonshotModel',
        placeholder: 'kimi-latest',
      },
    ],
  },
  // Fireworks
  {
    id: 'fireworks',
    conditions: { provider: api_providers.FIREWORKS },
    items: [
      { widget: 'key-manager', label: 'apiConnections.fireworksKey' },
      {
        id: 'api.selectedProviderModels.fireworks',
        widget: 'text-input',
        label: 'apiConnections.fireworksModel',
        placeholder: 'accounts/fireworks/models/kimi-k2-instruct',
      },
    ],
  },
  // CometAPI
  {
    id: 'cometapi',
    conditions: { provider: api_providers.COMETAPI },
    items: [
      { widget: 'key-manager', label: 'apiConnections.cometapiKey' },
      {
        id: 'api.selectedProviderModels.cometapi',
        widget: 'text-input',
        label: 'apiConnections.cometapiModel',
        placeholder: 'gpt-4o',
      },
    ],
  },
  // ZAI
  {
    id: 'zai',
    conditions: { provider: api_providers.ZAI },
    items: [
      { widget: 'key-manager', label: 'apiConnections.zaiKey' },
      {
        id: 'api.providerSpecific.zai.endpoint',
        widget: 'text-input',
        label: 'apiConnections.zaiEndpoint',
        placeholder: 'common',
      },
      {
        id: 'api.selectedProviderModels.zai',
        widget: 'text-input',
        label: 'apiConnections.zaiModel',
        placeholder: 'glm-4.6',
      },
    ],
  },
  // KoboldCPP
  {
    id: 'koboldcpp',
    conditions: { provider: api_providers.KOBOLDCPP },
    items: [
      {
        id: 'api.providerSpecific.koboldcpp.url',
        widget: 'text-input',
        label: 'apiConnections.koboldUrl',
        placeholder: 'http://localhost:5001/v1/chat/completions',
      },
    ],
  },
];
