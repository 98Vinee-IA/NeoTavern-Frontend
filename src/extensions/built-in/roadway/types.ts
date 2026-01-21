export interface RoadwaySettings {
  enabled: boolean;
  autoMode: boolean;

  choiceGenConnectionProfile?: string;
  choiceGenPrompt: string;
  choiceCount: number;

  impersonateConnectionProfile?: string;
  impersonatePrompt: string;
}

export interface RoadwayChatExtraData {
  enabled?: boolean;
}

export interface RoadwayMessageExtraData {
  choices?: string[];
  choiceMade?: boolean;
  isGeneratingChoices?: boolean;
}

export interface RoadwayChatExtra {
  'core.roadway'?: RoadwayChatExtraData;
}

export interface RoadwayMessageExtra {
  'core.roadway'?: RoadwayMessageExtraData;
}

export const DEFAULT_CHOICE_GEN_PROMPT = `Based on the provided chat history and the last message from the character, generate {{choiceCount}} distinct, creative, and plausible replies that the user could make next. The replies should be varied in tone and intent (e.g., one curious, one assertive, one playful).`;

export const DEFAULT_IMPERSONATE_PROMPT = `Based on the chat history and the user's general style, take the following directive and expand it into a full, detailed response from the user's perspective. Write the response as if you were the user.

Directive: "{{choice}}"`;

export const DEFAULT_SETTINGS: RoadwaySettings = {
  enabled: true,
  autoMode: true,
  choiceGenConnectionProfile: undefined,
  choiceGenPrompt: DEFAULT_CHOICE_GEN_PROMPT,
  choiceCount: 3,
  impersonateConnectionProfile: undefined,
  impersonatePrompt: DEFAULT_IMPERSONATE_PROMPT,
};
