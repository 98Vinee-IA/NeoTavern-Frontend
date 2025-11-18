import type { I18nKey } from './i18n';

export enum POPUP_TYPE {
  TEXT = 1,
  CONFIRM = 2,
  INPUT = 3,
  DISPLAY = 4,
  CROP = 5,
}

export enum POPUP_RESULT {
  AFFIRMATIVE = 1,
  NEGATIVE = 0,
  CANCELLED = -1,
}

export interface CustomPopupButton {
  text: string;
  result: number;
  classes?: string[] | string;
  isDefault?: boolean;
}

export interface PopupOptions {
  okButton?: I18nKey | boolean;
  cancelButton?: I18nKey | boolean;
  rows?: number;
  wide?: boolean;
  large?: boolean;
  customButtons?: CustomPopupButton[];
  defaultResult?: number;
  cropImage?: string;
}
export interface PopupState extends PopupOptions {
  id: string;
  visible: boolean;
  title: string;
  content: string;
  type: POPUP_TYPE;
  inputValue?: string;
}

export type PopupShowOptions = Partial<Omit<PopupState, 'id' | 'visible'>>;
