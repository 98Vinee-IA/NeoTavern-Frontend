import { delay, getBase64Async, getRequestHeaders, humanizedDateTime, onlyUnique } from '../../utils';
import DOMPurify from 'dompurify';
import { Toast } from '../Toast';
import {
  activeCharacterIndex,
  activeGroupId,
  activeMessageEditIndex,
  animation_duration,
  animation_easing,
  characters,
  chat,
  chatMetadata,
  createSave,
  cropData,
  default_avatar,
  DEFAULT_SAVE_EDIT_TIMEOUT,
  depth_prompt_depth_default,
  depth_prompt_role_default,
  favoriteCharacterChecked,
  groups,
  isChatSaving,
  isGroupGenerating,
  isSendPress,
  menuType,
  powerUser,
  selectedButton,
  TAG_FOLDER_TYPES,
  talkativeness_default,
  worldNames,
  type Character,
  type Entity,
  type Group,
  type MenuType,
  type Tag,
  type ThumbnailType,
} from '../../state/Store';
import { clearChat, refreshChat, resetSelectedGroup } from '../Chat';
import { Popup, POPUP_RESULT, POPUP_TYPE } from '../Popup';
import showdown from 'showdown';
import { accountStorage } from '../../AccountStorage';
import css, {} from '@adobe/css-tools';

const converter = new showdown.Converter({
  emoji: true,
  literalMidWordUnderscores: true,
  parseImgDimensions: true,
  tables: true,
  underline: true,
  simpleLineBreaks: true,
  strikethrough: true,
  disableForced4SpacesIndentedSublists: true,
  // extensions: [markdownUnderscoreExt()],
});

// converter.addExtension(markdownExclusionExt(), 'exclusion'); // TODO: Implement

export class CharactersBlock {
  readonly searchButton = document.getElementById('rm-button-search') as HTMLDivElement;
  readonly searchForm = document.getElementById('form-character-search-form') as HTMLDivElement;
  constructor() {
    this.searchButton.addEventListener('click', () => {
      this.searchForm.classList.toggle('active');
    });
  }
}

export async function refreshCharacters() {
  const response = await fetch('/api/characters/all', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    console.error('Failed to fetch characters:', response.statusText);
    const errorData = await response.json();
    if (errorData?.overflow) {
      Toast.warning(
        'Character data length limit reached. To resolve this, set "performance.lazyLoadCharacters" to "true" in config.yaml and restart the server.',
      );
    }
  }

  const resolvedActiveIndex = activeCharacterIndex.get();
  const resolvedCharacters = characters.get();
  const previousAvatar = resolvedActiveIndex !== null ? resolvedCharacters[resolvedActiveIndex]?.avatar : null;
  resolvedCharacters.splice(0, resolvedCharacters.length);

  const newCharacters = (await response.json()) as Character[];
  for (let i = 0; i < newCharacters.length; i++) {
    newCharacters[i].name = DOMPurify.sanitize(newCharacters[i].name);

    // For dropped-in cards
    if (!newCharacters[i].chat) {
      newCharacters[i].chat = `${newCharacters[i].name} - ${humanizedDateTime()}`;
    }

    newCharacters[i].chat = String(newCharacters[i].chat);
    resolvedCharacters.push(newCharacters[i]);
  }

  if (previousAvatar) {
    const newCharacterId = resolvedCharacters.findIndex((x) => x.avatar === previousAvatar);
    if (newCharacterId >= 0) {
      activeCharacterIndex.set(newCharacterId);
      await selectCharacterById(newCharacterId, { switchMenu: false });
    } else {
      Toast.error('The active character is no longer available. The page will be refreshed to prevent data loss.'); // TODO: Add callback on toast hidden, so that we can wait for user to see the message
      return location.reload();
    }
  }

  await refreshGroups();
  await printCharacters(true);
}

/**
 * Switches the currently selected character to the one with the given ID. (character index, not the character key!)
 *
 * If the character ID doesn't exist, if the chat is being saved, or if a group is being generated, this function does nothing.
 * If the character is different from the currently selected one, it will clear the chat and reset any selected character or group.
 * @param {boolean} [options.switchMenu=true] Whether to switch the right menu to the character edit menu if the character is already selected.
 * @returns {Promise<void>} A promise that resolves when the character is switched.
 */
export async function selectCharacterById(index: number, { switchMenu = true } = {}) {
  const resolvedCharacters = characters.get();

  if (resolvedCharacters[index] === undefined) {
    return;
  }

  if (isChatSaving.get()) {
    Toast.info('Please wait until the chat is saved before switching characters.', undefined, { timeOut: 5000 });
    return;
  }

  const resolvedActiveGroupId = activeGroupId.get();
  if (resolvedActiveGroupId && isGroupGenerating.get()) {
    return;
  }

  const resolvedActiveCharacterIndex = activeCharacterIndex.get();
  if (resolvedActiveGroupId || resolvedActiveCharacterIndex !== index) {
    //if clicked on a different character from what was currently selected
    if (!isSendPress.get()) {
      await clearChat();
      // cancelTtsPlay();
      resetSelectedGroup();
      activeMessageEditIndex.set(null);
      selectedButton.set('character_edit');
      activeCharacterIndex.set(index);
      chat.set([]);
      chatMetadata.set({});
      await refreshChat();
    }
  } else {
    //if clicked on character that was already selected
    switchMenu && selectedButton.set('character_edit');
    await unshallowCharacter(resolvedActiveCharacterIndex);
    select_selected_character(resolvedActiveCharacterIndex, { switchMenu });
  }
}

/**
 * Loads all the data of a shallow character.
 */
export async function unshallowCharacter(characterIndex: number | null) {
  if (characterIndex === null) {
    console.debug('Null character cannot be unshallowed');
    return;
  }

  const character = characters.get()[characterIndex];
  if (!character) {
    console.debug('Character not found:', characterIndex);
    return;
  }

  // Character is not shallow
  if (!character.shallow) {
    return;
  }

  const avatar = character.avatar;
  if (!avatar) {
    console.debug('Character has no avatar field:', characterIndex);
    return;
  }

  await loadOneCharacter(avatar);
}

export async function loadOneCharacter(avatar: string) {
  const response = await fetch('/api/characters/get', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      avatar_url: avatar,
    }),
  });

  const resolvedCharacters = characters.get();

  if (response.ok) {
    const getData = await response.json();
    getData['name'] = DOMPurify.sanitize(getData['name']);
    getData['chat'] = String(getData['chat']);

    const indexOf = resolvedCharacters.findIndex((x) => x.avatar === avatar);

    if (indexOf !== -1) {
      resolvedCharacters[indexOf] = getData;
    } else {
      Toast.error(`Character ${avatar} not found in the list`, undefined, { timeOut: 5000 });
    }
  }
}

/**
 * Selects the right menu for displaying the character editor.
 */
export function select_selected_character(index: number, { switchMenu = true } = {}) {
  //character select
  select_rm_create({ switchMenu });
  switchMenu && setMenuType('character_edit');
  document.getElementById('delete_button')!.style.display = 'flex';
  document.getElementById('export_button')!.style.display = 'flex';

  //create text poles
  document.getElementById('rm_button_back')!.style.display = 'none';
  (document.getElementById('create_button') as HTMLInputElement).value = 'Save'; // what is the use case for this?
  document.getElementById('dupe_button')!.style.display = 'flex';
  document.getElementById('create_button_label')!.style.display = 'none';
  document.getElementById('char_connections_button')!.style.display = 'flex';

  const resolvedActiveGroupId = activeGroupId.get();
  const resolvedCharacters = characters.get();
  // Hide the chat scenario button if we're peeking the group member defs
  document.getElementById('set_chat_character_settings')!.style.display = resolvedActiveGroupId ? 'none' : 'flex';

  // Don't update the navbar name if we're peeking the group member defs
  if (resolvedActiveGroupId === null) {
    document.getElementById('rm_button_selected_ch')!.querySelector('h2')!.textContent = resolvedCharacters[index].name;
  }

  (document.getElementById('add_avatar_button') as HTMLInputElement).value = '';

  (document.getElementById('character_popup-button-h3') as HTMLHeadingElement).textContent =
    resolvedCharacters[index].name;
  (document.getElementById('character_name_pole') as HTMLInputElement).value = resolvedCharacters[index].name;
  (document.getElementById('description_textarea') as HTMLTextAreaElement).value =
    resolvedCharacters[index].description || '';
  (document.getElementById('character_world') as HTMLInputElement).value =
    resolvedCharacters[index].data?.extensions?.world || '';
  (document.getElementById('creator_notes_textarea') as HTMLTextAreaElement).value =
    resolvedCharacters[index].data?.creator_notes || resolvedCharacters[index].creatorcomment || '';
  (document.getElementById('creator_notes_spoiler') as HTMLDivElement).innerHTML = formatCreatorNotes(
    resolvedCharacters[index].data?.creator_notes || resolvedCharacters[index].creatorcomment || '',
    resolvedCharacters[index].avatar,
  );
  (document.getElementById('character_version_textarea') as HTMLTextAreaElement).value =
    resolvedCharacters[index].data?.character_version || '';
  (document.getElementById('system_prompt_textarea') as HTMLTextAreaElement).value =
    resolvedCharacters[index].data?.system_prompt || '';
  (document.getElementById('post_history_instructions_textarea') as HTMLTextAreaElement).value =
    resolvedCharacters[index].data?.post_history_instructions || '';
  (document.getElementById('tags_textarea') as HTMLTextAreaElement).value = Array.isArray(
    resolvedCharacters[index].data?.tags,
  )
    ? resolvedCharacters[index].data.tags.join(', ')
    : '';
  (document.getElementById('creator_textarea') as HTMLTextAreaElement).value =
    resolvedCharacters[index].data?.creator || '';
  (document.getElementById('personality_textarea') as HTMLTextAreaElement).value =
    resolvedCharacters[index].personality || '';
  (document.getElementById('firstmessage_textarea') as HTMLTextAreaElement).value =
    resolvedCharacters[index].first_mes || '';

  (document.getElementById('scenario_pole') as HTMLInputElement).value = resolvedCharacters[index].scenario || '';
  (document.getElementById('depth_prompt_prompt') as HTMLInputElement).value =
    resolvedCharacters[index].data?.extensions?.depth_prompt?.prompt || '';
  (document.getElementById('depth_prompt_depth') as HTMLInputElement).value = String(
    resolvedCharacters[index].data?.extensions?.depth_prompt?.depth || depth_prompt_depth_default,
  );
  (document.getElementById('depth_prompt_role') as HTMLInputElement).value =
    resolvedCharacters[index].data?.extensions?.depth_prompt?.role || depth_prompt_role_default;
  (document.getElementById('talkativeness_slider') as HTMLInputElement).value = String(
    resolvedCharacters[index].talkativeness || talkativeness_default,
  );
  (document.getElementById('mes_example_textarea') as HTMLTextAreaElement).value =
    resolvedCharacters[index].mes_example || '';
  (document.getElementById('selected_chat_pole') as HTMLInputElement).value = resolvedCharacters[index].chat || '';
  (document.getElementById('create_date_pole') as HTMLInputElement).value = resolvedCharacters[index].create_date || '';
  (document.getElementById('avatar_url_pole') as HTMLInputElement).value = resolvedCharacters[index].avatar || '';
  (document.getElementById('chat_import_avatar_url') as HTMLInputElement).value =
    resolvedCharacters[index].avatar || '';
  (document.getElementById('chat_import_character_name') as HTMLInputElement).value =
    resolvedCharacters[index].name || '';
  (document.getElementById('character_json_data') as HTMLTextAreaElement).value =
    resolvedCharacters[index].json_data || '';

  updateFavButtonState(resolvedCharacters[index].fav === true || resolvedCharacters[index].fav == 'true');

  const avatarUrl =
    resolvedCharacters[index].avatar != 'none'
      ? getThumbnailUrl('avatar', resolvedCharacters[index].avatar)
      : default_avatar;
  (document.getElementById('avatar_load_preview') as HTMLImageElement).setAttribute('src', avatarUrl);
  (document.querySelector('.open_alternate_greetings') as HTMLDivElement).dataset.chid = String(index);
  (document.getElementById('set_character_world') as HTMLDivElement).dataset.chid = String(index);
  setWorldInfoButtonClass(index);
  checkEmbeddedWorld(index);

  document.getElementById('name_div')!.classList.remove('displayBlock');
  document.getElementById('name_div')!.classList.add('displayNone');
  document.getElementById('renameCharButton')!.style.display = 'flex';

  document.getElementById('form_create')!.setAttribute('actiontype', 'editcharacter');
  (document.querySelector('.form_create_bottom_buttons_block .chat_lorebook_button') as HTMLDivElement).style.display =
    'flex';

  const externalMediaState = isExternalMediaAllowed();
  document.getElementById('character_open_media_overrides')!.style.display = resolvedActiveGroupId ? 'none' : 'flex';
  document.getElementById('character_media_allowed_icon')!.style.display = externalMediaState ? 'flex' : 'none';
  document.getElementById('character_media_forbidden_icon')!.style.display = externalMediaState ? 'none' : 'flex';

  // Update some stuff about the char management dropdown
  (document.getElementById('character_source') as HTMLInputElement).disabled = !getCharacterSource(index);

  // eventSource.emit(event_types.CHARACTER_EDITOR_OPENED, index); // TODO: Implement

  // saveSettingsDebounced(); // TODO: Implement
}

/**
 * Selects the right menu for creating a new character.
 */
function select_rm_create({ switchMenu = true } = {}) {
  switchMenu && setMenuType('create');

  const resolvedSelectedButton = selectedButton.get();
  const resolvedCreateSave = createSave.get();
  if (resolvedSelectedButton == 'create' && resolvedCreateSave.avatar) {
    // const addAvatarInput = /** @type {HTMLInputElement} */ ($('#add_avatar_button').get(0));
    const addAvatarInput = document.getElementById('add_avatar_button') as HTMLInputElement;
    addAvatarInput.files = resolvedCreateSave.avatar;
    read_avatar_load(addAvatarInput);
  }

  switchMenu && selectRightMenuWithAnimation('rm_ch_create_block');

  document.getElementById('set_chat_character_settings')!.style.display = 'none';
  document.getElementById('delete_button_div')!.style.display = 'none';
  document.getElementById('delete_button')!.style.display = 'none';
  document.getElementById('export_button')!.style.display = 'none';
  document.getElementById('create_button_label')!.style.display = '';
  (document.getElementById('create_button') as HTMLInputElement).value = 'Create';
  document.getElementById('dupe_button')!.style.display = 'none';
  document.getElementById('char_connections_button')!.style.display = 'none';

  //create text poles
  document.getElementById('rm_button_back')!.style.display = '';
  document.getElementById('character_import_button')!.style.display = '';
  document.getElementById('character_popup-button-h3')!.textContent = 'Create character';
  (document.getElementById('character_name_pole') as HTMLInputElement).value = resolvedCreateSave.name;
  (document.getElementById('description_textarea') as HTMLTextAreaElement).value = resolvedCreateSave.description;
  (document.getElementById('character_world') as HTMLInputElement).value = resolvedCreateSave.world;
  (document.getElementById('creator_notes_textarea') as HTMLTextAreaElement).value = resolvedCreateSave.creator_notes;
  document.getElementById('creator_notes_spoiler')!.innerHTML = formatCreatorNotes(
    resolvedCreateSave.creator_notes,
    '',
  );
  (document.getElementById('post_history_instructions_textarea') as HTMLTextAreaElement).value =
    resolvedCreateSave.post_history_instructions;
  (document.getElementById('system_prompt_textarea') as HTMLTextAreaElement).value = resolvedCreateSave.system_prompt;
  (document.getElementById('tags_textarea') as HTMLTextAreaElement).value = resolvedCreateSave.tags;
  (document.getElementById('creator_textarea') as HTMLTextAreaElement).value = resolvedCreateSave.creator;
  (document.getElementById('character_version_textarea') as HTMLTextAreaElement).value =
    resolvedCreateSave.character_version;
  (document.getElementById('personality_textarea') as HTMLTextAreaElement).value = resolvedCreateSave.personality;
  (document.getElementById('firstmessage_textarea') as HTMLTextAreaElement).value = resolvedCreateSave.first_message;
  (document.getElementById('talkativeness_slider') as HTMLInputElement).value = String(
    resolvedCreateSave.talkativeness,
  );
  (document.getElementById('scenario_pole') as HTMLInputElement).value = resolvedCreateSave.scenario;
  (document.getElementById('depth_prompt_prompt') as HTMLInputElement).value = resolvedCreateSave.depth_prompt_prompt;
  (document.getElementById('depth_prompt_depth') as HTMLInputElement).value = String(
    resolvedCreateSave.depth_prompt_depth,
  );
  (document.getElementById('depth_prompt_role') as HTMLInputElement).value = resolvedCreateSave.depth_prompt_role;
  (document.getElementById('mes_example_textarea') as HTMLTextAreaElement).value = resolvedCreateSave.mes_example;
  (document.getElementById('character_json_data') as HTMLTextAreaElement).value = '';
  (document.getElementById('avatar_div') as HTMLDivElement).style.display = 'flex';
  (document.getElementById('avatar_load_preview') as HTMLImageElement).setAttribute('src', default_avatar);
  document.getElementById('renameCharButton')!.style.display = 'none';
  document.getElementById('name_div')!.classList.remove('displayNone');
  document.getElementById('name_div')!.classList.add('displayBlock');
  (document.querySelector('.open_alternate_greetings') as HTMLDivElement).dataset.chid = '-1';
  (document.getElementById('set_character_world') as HTMLDivElement).dataset.chid = '-1';

  setWorldInfoButtonClass(null, !!resolvedCreateSave.world);
  updateFavButtonState(false);
  checkEmbeddedWorld();

  (document.getElementById('form_create') as HTMLFormElement).setAttribute('actiontype', 'createcharacter');
  (document.querySelector('.form_create_bottom_buttons_block .chat_lorebook_button') as HTMLDivElement).style.display =
    'none';
  (document.getElementById('character_open_media_overrides') as HTMLDivElement).style.display = 'none';
}

export function setMenuType(value: MenuType) {
  menuType.set(value);
  // Allow custom CSS to see which menu type is active
  document.getElementById('right-nav-panel')!.dataset.menuType = menuType.get() ?? undefined;
}

/**
 * Processes the avatar image from the input element, allowing the user to crop it if necessary.
 */
async function read_avatar_load(input: HTMLInputElement): Promise<void> {
  if (input.files && input.files[0]) {
    if (selectedButton.get() === 'create') {
      createSave.set({ ...createSave.get(), avatar: input.files });
    }

    cropData.set(null);
    const file = input.files[0];
    const fileData = await getBase64Async(file);

    if (!powerUser.get().never_resize_avatars) {
      const dlg = new Popup('Set the crop position of the avatar image', POPUP_TYPE.CROP, '', { cropImage: fileData });
      const croppedImage = await dlg.show();

      if (!croppedImage) {
        return;
      }

      cropData.set(dlg.value);
      document.getElementById('avatar_load_preview')!.setAttribute('src', String(croppedImage));
    } else {
      document.getElementById('avatar_load_preview')!.setAttribute('src', fileData);
    }

    if (menuType.get() === 'create') {
      return;
    }

    // await createOrEditCharacter(); // TODO: Implement
    await delay(DEFAULT_SAVE_EDIT_TIMEOUT);

    const formData = new FormData(document.getElementById('form_create') as HTMLFormElement);
    if (!formData) throw new Error('Form data is null');
    await fetch(getThumbnailUrl('avatar', formData.get('avatar_url')!.toString()), {
      method: 'GET',
      cache: 'reload',
    });

    const messages = document.querySelectorAll<HTMLElement>('.mes');
    messages.forEach(async (el) => {
      const nameMatch = el.getAttribute('ch_name') === formData.get('ch_name')?.toString();
      if (el.getAttribute('is_system') === 'true' && !nameMatch) return;
      if (el.getAttribute('is_user') === 'true') return;

      if (nameMatch) {
        const previewSrc = document.getElementById('avatar_load_preview')?.getAttribute('src') || '';
        const avatar = el.querySelector<HTMLElement>('.avatar img');
        if (avatar) {
          avatar.setAttribute('src', default_avatar);
          await delay(1);
          avatar.setAttribute('src', previewSrc);
        }
      }
    });

    console.log('Avatar refreshed');
  }
}

/**
 * Gets the URL for a thumbnail of a specific type and file.
 * @param type The type of the thumbnail to get
 * @param file The file name or path for which to get the thumbnail URL
 * @param [t=false] Whether to add a cache-busting timestamp to the URL
 */
export function getThumbnailUrl(type: ThumbnailType, file: string, t = false) {
  return `/thumbnail?type=${type}&file=${encodeURIComponent(file)}${t ? `&t=${Date.now()}` : ''}`;
}

export function selectRightMenuWithAnimation(selectedMenuId: string) {
  const displayModes = {
    rm_group_chats_block: 'flex',
    rm_api_block: 'grid',
    rm_characters_block: 'flex',
  };
  document.getElementById('result_info')!.style.display = selectedMenuId === 'rm_ch_create_block' ? 'block' : 'none';
  // @ts-ignore
  document.querySelectorAll('#right-nav-panel .right_menu').forEach((menu: HTMLElement) => {
    menu.style.display = 'none';

    if (selectedMenuId && selectedMenuId.replace('#', '') === menu.id) {
      // @ts-ignore
      const mode = displayModes[menu.id] ?? 'block';
      menu.style.display = mode;
      menu.style.opacity = '0.0';
      menu.animate([{ opacity: '0.0' }, { opacity: '1.0' }], {
        duration: animation_duration,
        easing: animation_easing,
        fill: 'forwards',
      });
    }
  });
}

/**
 * Formats creator notes in the message text.
 * @param {string} text Raw Markdown text
 * @param {string} avatarId Avatar ID
 * @returns {string} Formatted HTML text
 */
export function formatCreatorNotes(text: string, avatarId: string) {
  const preference = new StylesPreference(avatarId);
  const sanitizeStyles = !preference.get();
  const decodeStyleParam = { prefix: sanitizeStyles ? '#creator_notes_spoiler ' : '' };
  /** @type {import('dompurify').Config & { MESSAGE_SANITIZE: boolean }} */
  const config = {
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
    MESSAGE_SANITIZE: true,
    ADD_TAGS: ['custom-style'],
  };

  // let html = converter.makeHtml(substituteParams(text)); // TODO: Implement substituteParams
  let html = converter.makeHtml(text);
  html = encodeStyleTags(html);
  html = DOMPurify.sanitize(html, config);
  html = decodeStyleTags(html, decodeStyleParam);

  return html;
}

/**
 * Replaces style tags in the message text with custom tags with encoded content.
 * @param {string} text
 * @returns {string} Encoded message text
 * @copyright https://github.com/kwaroran/risuAI
 */
export function encodeStyleTags(text: string) {
  const styleRegex = /<style>(.+?)<\/style>/gims;
  return text.replaceAll(styleRegex, (_, match) => {
    return `<custom-style>${encodeURIComponent(match)}</custom-style>`;
  });
}

/**
 * Sanitizes custom style tags in the message text to prevent DOM pollution.
 * @param {string} text Message text
 * @param {object} options Options object
 * @param {string} options.prefix Prefix the selectors with this value
 * @returns {string} Sanitized message text
 * @copyright https://github.com/kwaroran/risuAI
 */
export function decodeStyleTags(text: string, { prefix } = { prefix: '.mes_text ' }) {
  const styleDecodeRegex = /<custom-style>(.+?)<\/custom-style>/gms;
  const mediaAllowed = isExternalMediaAllowed();

  function sanitizeRule(rule) {
    if (Array.isArray(rule.selectors)) {
      for (let i = 0; i < rule.selectors.length; i++) {
        const selector = rule.selectors[i];
        if (selector) {
          rule.selectors[i] = prefix + sanitizeSelector(selector);
        }
      }
    }
    if (!mediaAllowed && Array.isArray(rule.declarations) && rule.declarations.length > 0) {
      rule.declarations = rule.declarations.filter((declaration) => !declaration.value.includes('://'));
    }
  }

  function sanitizeSelector(selector) {
    // Handle pseudo-classes that can contain nested selectors
    const pseudoClasses = ['has', 'not', 'where', 'is', 'matches', 'any'];
    const pseudoRegex = new RegExp(`:(${pseudoClasses.join('|')})\\(([^)]+)\\)`, 'g');

    // First, sanitize any nested selectors within pseudo-classes
    selector = selector.replace(pseudoRegex, (match, pseudoClass, content) => {
      // Recursively sanitize the content within the pseudo-class
      const sanitizedContent = sanitizeSimpleSelector(content);
      return `:${pseudoClass}(${sanitizedContent})`;
    });

    // Then sanitize the main selector parts
    return sanitizeSimpleSelector(selector);
  }

  function sanitizeSimpleSelector(selector) {
    // Split by spaces but preserve complex selectors
    return selector
      .split(/\s+/)
      .map((part) => {
        // Handle class selectors, but preserve pseudo-classes and other complex parts
        return part.replace(/\.([\w-]+)/g, (match, className) => {
          // Don't modify if it's already prefixed with 'custom-'
          if (className.startsWith('custom-')) {
            return match;
          }
          return `.custom-${className}`;
        });
      })
      .join(' ');
  }

  function sanitizeRuleSet(ruleSet) {
    if (Array.isArray(ruleSet.selectors) || Array.isArray(ruleSet.declarations)) {
      sanitizeRule(ruleSet);
    }

    if (Array.isArray(ruleSet.rules)) {
      ruleSet.rules = ruleSet.rules.filter((rule) => rule.type !== 'import');

      for (const mediaRule of ruleSet.rules) {
        sanitizeRuleSet(mediaRule);
      }
    }
  }

  return text.replaceAll(styleDecodeRegex, (_, style) => {
    try {
      let styleCleaned = decodeURIComponent(style).replaceAll(/<br\/>/g, '');
      const ast = css.parse(styleCleaned);
      const sheet = ast?.stylesheet;
      if (sheet) {
        sanitizeRuleSet(ast.stylesheet);
      }
      return `<style>${css.stringify(ast)}</style>`;
    } catch (error) {
      return `CSS ERROR: ${error}`;
    }
  });
}

/**
 * Class to manage style preferences for characters.
 */
class StylesPreference {
  private avatarId: string | null;

  /**
   * Creates a new StylesPreference instance.
   * @param {string|null} avatarId - The avatar ID of the character
   */
  constructor(avatarId: string | null) {
    this.avatarId = avatarId;
  }

  /**
   * Gets the account storage key for the style preference.
   */
  get key() {
    return `AllowGlobalStyles-${this.avatarId}`;
  }

  /**
   * Checks if a preference exists for this character.
   * @returns {boolean} True if preference exists, false otherwise
   */
  exists() {
    return this.avatarId ? accountStorage.getItem(this.key) !== null : true; // No character == assume preference is set
  }

  /**
   * Gets the current style preference.
   * @returns {boolean} True if global styles are allowed, false otherwise
   */
  get() {
    return this.avatarId ? accountStorage.getItem(this.key) === 'true' : false; // Always disabled when creating a new character
  }

  /**
   * Sets the global styles preference.
   * @param {boolean} allowed - Whether global styles are allowed
   */
  set(allowed: boolean) {
    if (this.avatarId) {
      accountStorage.setItem(this.key, String(allowed));
    }
  }
}

export function isExternalMediaAllowed() {
  const entityId = getCurrentEntityId();
  const resolvedPowerUser = powerUser.get();
  if (!entityId) {
    return !resolvedPowerUser.forbid_external_media;
  }

  if (resolvedPowerUser.external_media_allowed_overrides.includes(entityId)) {
    return true;
  }

  if (resolvedPowerUser.external_media_forbidden_overrides.includes(entityId)) {
    return false;
  }

  return !resolvedPowerUser.forbid_external_media;
}

export function getCurrentEntityId() {
  const resolvedActiveGroupId = activeGroupId.get();
  if (resolvedActiveGroupId) {
    return String(resolvedActiveGroupId);
  }

  const resolvedActiveCharacterIndex = activeCharacterIndex.get();
  const resolvedCharacters = characters.get();
  return resolvedActiveCharacterIndex !== null
    ? (resolvedCharacters[resolvedActiveCharacterIndex]?.avatar ?? null)
    : null;
}

export function setWorldInfoButtonClass(characterIndex: number | null, forceValue: boolean | undefined = undefined) {
  if (forceValue !== undefined) {
    // $('#set_character_world, #world_button').toggleClass('world_set', forceValue);
    document.getElementById('set_character_world')!.classList.toggle('world_set', forceValue);
    document.getElementById('world_button')!.classList.toggle('world_set', forceValue);
    return;
  }

  if (characterIndex === null) {
    return;
  }

  const resolvedCharacters = characters.get();
  const world = resolvedCharacters[characterIndex]?.data?.extensions?.world;
  const worldSet = Boolean(world && worldNames.get().includes(world));
  document.getElementById('set_character_world')!.classList.toggle('world_set', worldSet);
  document.getElementById('world_button')!.classList.toggle('world_set', worldSet);
}

export function checkEmbeddedWorld(characterIndex: number | null = null): boolean {
  // $('#import_character_info').hide();
  document.getElementById('import_character_info')!.style.display = 'none';

  if (characterIndex === null) {
    return false;
  }

  const resolvedCharacters = characters.get();
  if (resolvedCharacters[characterIndex]?.data?.character_book) {
    document.getElementById('import_character_info')!.dataset.chid = String(characterIndex);
    document.getElementById('import_character_info')!.style.display = 'block';

    // Only show the alert once per character
    const checkKey = `AlertWI_${resolvedCharacters[characterIndex].avatar}`;
    const worldName = resolvedCharacters[characterIndex]?.data?.extensions?.world;
    if (!accountStorage.getItem(checkKey) && (!worldName || !worldNames.get().includes(worldName))) {
      accountStorage.setItem(checkKey, 'true');

      if (powerUser.get().world_import_dialog) {
        const html = `<h3>This character has an embedded World/Lorebook.</h3>
                <h3>Would you like to import it now?</h3>
                <div class="m-b-1">If you want to import it later, select "Import Card Lore" in the "More..." dropdown menu on the character panel.</div>`;
        const checkResult = (result: POPUP_RESULT | number | null) => {
          if (result) {
            importEmbeddedWorldInfo(true);
          }
        };
        Popup.confirm('', html, { okButton: 'Yes' }).then(checkResult);
      } else {
        Toast.info(
          'To import and use it, select "Import Card Lore" in the "More..." dropdown menu on the character panel.',
          `${resolvedCharacters[characterIndex].name} has an embedded World/Lorebook`,
          { timeOut: 5000, extendedTimeOut: 10000 },
        );
      }
    }
    return true;
  }

  return false;
}

export async function importEmbeddedWorldInfo(skipPopup = false) {
  const characterIndexStr: string | undefined = document.getElementById('import_character_info')!.dataset.chid;
  const characterIndex = characterIndexStr ? parseInt(characterIndexStr) : undefined;

  if (characterIndex === undefined || characterIndex === -1) {
    return;
  }

  const hasEmbed = checkEmbeddedWorld(characterIndex);
  if (!hasEmbed) {
    return;
  }

  const resolvedCharacters = characters.get();
  const resolvedWorldNames = worldNames.get();
  const bookName =
    resolvedCharacters[characterIndex]?.data?.character_book?.name ||
    `${resolvedCharacters[characterIndex]?.name}'s Lorebook`;

  if (!skipPopup) {
    const confirmation = await Popup.confirm(
      `Are you sure you want to import '${bookName}'?`,
      resolvedWorldNames.includes(bookName) ? `It will overwrite the World/Lorebook with the same name.` : '',
    );
    if (!confirmation) {
      return;
    }
  }

  // const convertedBook = convertCharacterBook(resolvedCharacters[characterIndex].data.character_book); // TODO: Implement

  // await saveWorldInfo(bookName, convertedBook, true); // TODO: Implement
  // await updateWorldInfoList(); // TODO: Implement
  (document.getElementById('character_world') as HTMLInputElement).value = bookName;

  Toast.success(
    `The world '${bookName}' has been imported and linked to the character successfully.`,
    `World/Lorebook imported`,
  );

  const newIndex = resolvedWorldNames.indexOf(bookName);
  if (newIndex >= 0) {
    //show&draw the WI panel before..
    (document.getElementById('WIDrawerIcon') as HTMLElement).click();
    //..auto-opening the new imported WI
    (document.getElementById('world_editor_select') as HTMLSelectElement).value = String(newIndex);
    (document.getElementById('world_editor_select') as HTMLElement).dispatchEvent(new Event('change'));
  }

  setWorldInfoButtonClass(characterIndex, true);
}

/**
 * Updates the state of the favorite button based on the provided state.
 * @param {boolean} state Whether the favorite button should be on or off.
 */
function updateFavButtonState(state: boolean) {
  // Update global state of the flag
  // TODO: This is bad and needs to be refactored.
  favoriteCharacterChecked.set(state);
  document.getElementById('fav_checkbox')!.setAttribute('checked', state ? 'true' : 'false');
  document.getElementById('favorite_button')!.classList.toggle('fav_on', state);
  document.getElementById('favorite_button')!.classList.toggle('fav_off', !state);
}

function getCharacterSource(index: number) {
  const resolvedCharacters = characters.get();
  const character = resolvedCharacters[index];

  if (!character) {
    return '';
  }

  const chubId = resolvedCharacters[index]?.data?.extensions?.chub?.full_path;

  if (chubId) {
    return `https://chub.ai/characters/${chubId}`;
  }

  const pygmalionId = resolvedCharacters[index]?.data?.extensions?.pygmalion_id;

  if (pygmalionId) {
    return `https://pygmalion.chat/${pygmalionId}`;
  }

  const githubRepo = resolvedCharacters[index]?.data?.extensions?.github_repo;

  if (githubRepo) {
    return `https://github.com/${githubRepo}`;
  }

  const sourceUrl = resolvedCharacters[index]?.data?.extensions?.source_url;

  if (sourceUrl) {
    return sourceUrl;
  }

  const risuId = resolvedCharacters[index]?.data?.extensions?.risuai?.source;

  if (Array.isArray(risuId) && risuId.length && typeof risuId[0] === 'string' && risuId[0].startsWith('risurealm:')) {
    const realmId = risuId[0].split(':')[1];
    return `https://realm.risuai.net/character/${realmId}`;
  }

  const perchanceSlug = resolvedCharacters[index]?.data?.extensions?.perchance_data?.slug;

  if (perchanceSlug) {
    return `https://perchance.org/ai-character-chat?data=${perchanceSlug}`;
  }

  return '';
}

async function refreshGroups() {
  const response = await fetch('/api/groups/all', {
    method: 'POST',
    headers: getRequestHeaders(),
  });

  if (response.ok) {
    const data = (await response.json()) as Group[];
    // @ts-ignore
    groups.set(data.sort((a, b) => a.id - b.id));

    // Convert groups to new format
    for (const group of groups.get()) {
      if (typeof group.id === 'number') {
        group.id = String(group.id);
      }
      if (group.disabled_members == undefined) {
        group.disabled_members = [];
      }
      if (group.chat_id == undefined) {
        group.chat_id = group.id;
        group.chats = [group.id];
        group.members = group.members
          .map((x) => characters.get().find((y) => y.name == x)?.avatar)
          .filter((x) => x !== undefined)
          .filter(onlyUnique);
      }
      if (group.past_metadata == undefined) {
        group.past_metadata = {};
      }
      if (typeof group.chat_id === 'number') {
        group.chat_id = String(group.chat_id);
      }
      if (Array.isArray(group.chats) && group.chats.some((x) => typeof x === 'number')) {
        group.chats = group.chats.map((x) => String(x));
      }
    }
  }
}

/**
 * Prints the global character list, optionally doing a full refresh of the list
 * Use this function whenever the reprinting of the character list is the primary focus, otherwise using `printCharactersDebounced` is preferred for a cleaner, non-blocking experience.
 *
 * The printing will also always reprint all filter options of the global list, to keep them up to date.
 *
 * @param {boolean} fullRefresh - If true, the list is fully refreshed and the navigation is being reset
 */
export async function printCharacters(fullRefresh = false) {
  const storageKey = 'Characters_PerPage';
  const listId = '#rm_print_characters_block';

  // let currentScrollTop = $(listId).scrollTop();
  let currentScrollTop = document.querySelector<HTMLElement>(listId)?.scrollTop || 0;

  if (fullRefresh) {
    saveCharactersPage = 0;
    currentScrollTop = 0;
    await delay(1);
  }

  // Before printing the personas, we check if we should enable/disable search sorting
  // verifyCharactersSearchSortRule(); TODO: Implement

  // We are actually always reprinting filters, as it "doesn't hurt", and this way they are always up to date
  // printTagFilters(tag_filter_type.character); // TODO: Implement
  // printTagFilters(tag_filter_type.group_member); // TODO: Implement

  // We are also always reprinting the lists on character/group edit window, as these ones doesn't get updated otherwise
  // applyTagsOnCharacterSelect(); // TODO: Implement
  // applyTagsOnGroupSelect(); // TODO: Implement

  const entities = getEntitiesList({ doFilter: true });

  const pageSize = Number(accountStorage.getItem(storageKey)) || per_page_default;
  const sizeChangerOptions = [10, 25, 50, 100, 250, 500, 1000];
  $('#rm_print_characters_pagination').pagination({
    dataSource: entities,
    pageSize,
    pageRange: 1,
    pageNumber: saveCharactersPage || 1,
    position: 'top',
    showPageNumbers: false,
    showSizeChanger: true,
    prevText: '<',
    nextText: '>',
    formatNavigator: PAGINATION_TEMPLATE,
    formatSizeChanger: renderPaginationDropdown(pageSize, sizeChangerOptions),
    showNavigator: true,
    callback: async function (/** @type {Entity[]} */ data) {
      $(listId).empty();
      if (powerUser.get().bogus_folders && isBogusFolderOpen()) {
        $(listId).append(getBackBlock());
      }
      if (!data.length) {
        const emptyBlock = await getEmptyBlock();
        $(listId).append(emptyBlock);
      }
      let displayCount = 0;
      for (const i of data) {
        switch (i.type) {
          case 'character':
            $(listId).append(getCharacterBlock(i.item, i.id));
            displayCount++;
            break;
          case 'group':
            $(listId).append(getGroupBlock(i.item));
            displayCount++;
            break;
          case 'tag':
            $(listId).append(getTagBlock(i.item, i.entities, i.hidden, i.isUseless));
            break;
        }
      }

      const hidden = characters.length + groups.length - displayCount;
      if (hidden > 0 && entitiesFilter.hasAnyFilter()) {
        const hiddenBlock = await getHiddenBlock(hidden);
        $(listId).append(hiddenBlock);
      }
      localizePagination($('#rm_print_characters_pagination'));

      // eventSource.emit(event_types.CHARACTER_PAGE_LOADED); // TODO: Implement
    },
    afterSizeSelectorChange: function (e, size) {
      accountStorage.setItem(storageKey, e.target.value);
      paginationDropdownChangeHandler(e, size);
    },
    afterPaging: function (e) {
      saveCharactersPage = e;
    },
    afterRender: function () {
      $(listId).scrollTop(currentScrollTop);
    },
  });

  favsToHotswap();
  updatePersonaConnectionsAvatarList();
}

/**
 * Builds the full list of all entities available
 *
 * They will be correctly marked and filtered.
 *
 * @param {object} param0 - Optional parameters
 * @param {boolean} [param0.doFilter] - Whether this entity list should already be filtered based on the global filters
 * @param {boolean} [param0.doSort] - Whether the entity list should be sorted when returned
 * @returns {Entity[]} All entities
 */
export function getEntitiesList({ doFilter = false, doSort = true } = {}) {
  const resolvedCharacters = characters.get();
  const resolvedGroups = groups.get();

  let entities = [
    ...resolvedCharacters.map((item, index) => characterToEntity(item, index)),
    ...resolvedGroups.map((item) => groupToEntity(item)),
    // ...(power_user.bogus_folders ? tags.filter(isBogusFolder).sort(compareTagsForSort).map(item => tagToEntity(item)) : []), // TODO: Implement
  ];

  // We need to do multiple filter runs in a specific order, otherwise different settings might override each other
  // and screw up tags and search filter, sub lists or similar.
  // The specific filters are written inside the "filterByTagState" method and its different parameters.
  // Generally what we do is the following:
  //   1. First swipe over the list to remove the most obvious things
  //   2. Build sub entity lists for all folders, filtering them similarly to the second swipe
  //   3. We do the last run, where global filters are applied, and the search filters last

  // First run filters, that will hide what should never be displayed
  if (doFilter) {
    entities = filterByTagState(entities);
  }

  // Run over all entities between first and second filter to save some states
  for (const entity of entities) {
    // For folders, we remember the sub entities so they can be displayed later, even if they might be filtered
    // Those sub entities should be filtered and have the search filters applied too
    if (entity.type === 'tag') {
      let subEntities = filterByTagState(entities, { subForEntity: entity, filterHidden: false });
      const subCount = subEntities.length;
      subEntities = filterByTagState(entities, { subForEntity: entity });
      if (doFilter) {
        // sub entities filter "hacked" because folder filter should not be applied there, so even in "only folders" mode characters show up
        subEntities = entitiesFilter.applyFilters(subEntities, {
          clearScoreCache: false,
          tempOverrides: { [FILTER_TYPES.FOLDER]: FILTER_STATES.UNDEFINED },
          clearFuzzySearchCaches: false,
        });
      }
      if (doSort) {
        sortEntitiesList(subEntities, false);
      }
      entity.entities = subEntities;
      entity.hidden = subCount - subEntities.length;
    }
  }

  // Second run filters, hiding whatever should be filtered later
  if (doFilter) {
    const beforeFinalEntities = filterByTagState(entities, { globalDisplayFilters: true });
    entities = entitiesFilter.applyFilters(beforeFinalEntities, { clearFuzzySearchCaches: false });

    // Magic for folder filter. If that one is enabled, and no folders are display anymore, we remove that filter to actually show the characters.
    if (
      isFilterState(entitiesFilter.getFilterData(FILTER_TYPES.FOLDER), FILTER_STATES.SELECTED) &&
      entities.filter((x) => x.type == 'tag').length == 0
    ) {
      entities = entitiesFilter.applyFilters(beforeFinalEntities, {
        tempOverrides: { [FILTER_TYPES.FOLDER]: FILTER_STATES.UNDEFINED },
        clearFuzzySearchCaches: false,
      });
    }
  }

  // Final step, updating some properties after the last filter run
  const nonTagEntitiesCount = entities.filter((entity) => entity.type !== 'tag').length;
  for (const entity of entities) {
    if (entity.type === 'tag') {
      if (entity.entities?.length == nonTagEntitiesCount) entity.isUseless = true;
    }
  }

  // Sort before returning if requested
  if (doSort) {
    sortEntitiesList(entities, false);
  }
  entitiesFilter.clearFuzzySearchCaches();
  return entities;
}

/**
 * Converts the given character to its entity representation
 *
 * @param {Character} character - The character
 * @param {string|number} index - The id of this character
 * @returns {Entity} The entity for this character
 */
export function characterToEntity(character: Character, index: number): Entity {
  return { item: character, id: index, type: 'character' };
}

/**
 * Converts the given group to its entity representation
 *
 * @param {Group} group - The group
 * @returns {Entity} The entity for this group
 */
export function groupToEntity(group: Group): Entity {
  return { item: group, id: group.id, type: 'group' };
}

/**
 * Converts the given tag to its entity representation
 */
export function tagToEntity(tag: Tag): Entity {
  return { item: structuredClone(tag), id: tag.id, type: 'tag', entities: [] };
}

/**
 * Applies the basic filter for the current state of the tags and their selection on an entity list.
 * @param {Array<Object>} entities List of entities for display, consisting of tags, characters and groups.
 * @param {Object} param1 Optional parameters, explained below.
 * @param {Boolean} [param1.globalDisplayFilters] When enabled, applies the final filter for the global list. Icludes filtering out entities in closed/hidden folders and empty folders.
 * @param {Object} [param1.subForEntity] When given an entity, the list of entities gets filtered specifically for that one as a "sub list", filtering out other tags, elements not tagged for this and hidden elements.
 * @param {Boolean} [param1.filterHidden] Optional switch with which filtering out hidden items (from closed folders) can be disabled.
 * @returns The filtered list of entities
 */
function filterByTagState(
  entities: Entity[],
  { globalDisplayFilters = false, subForEntity = undefined, filterHidden = true } = {},
) {
  const filterData = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));

  entities = entities.filter((entity) => {
    if (entity.type === 'tag') {
      // Remove folders that are already filtered on
      if (filterData.selected.includes(entity.id) || filterData.excluded.includes(entity.id)) {
        return false;
      }
    }

    return true;
  });

  if (globalDisplayFilters) {
    // Prepare some data for caching and performance
    const closedFolders = entities.filter(
      (x) => x.type === 'tag' && TAG_FOLDER_TYPES[x.item.folder_type] === TAG_FOLDER_TYPES.CLOSED,
    );

    entities = entities.filter((entity) => {
      // Hide entities that are in a closed folder, unless that one is opened
      if (
        filterHidden &&
        entity.type !== 'tag' &&
        closedFolders.some((f) => entitiesFilter.isElementTagged(entity, f.id) && !filterData.selected.includes(f.id))
      ) {
        return false;
      }

      // Hide folders that have 0 visible sub entities after the first filtering round, unless we are inside a search via search term.
      // Then we want to display folders that mach too, even if the chars inside don't match the search.
      if (entity.type === 'tag') {
        return entity.entities.length > 0 || entitiesFilter.getFilterData(FILTER_TYPES.SEARCH);
      }

      return true;
    });
  }

  if (subForEntity !== undefined && subForEntity.type === 'tag') {
    entities = filterTagSubEntities(subForEntity.item, entities, { filterHidden: filterHidden });
  }

  return entities;
}

/**
 * Filter a a list of entities based on a given tag, returning all entities that represent "sub entities"
 */
function filterTagSubEntities(tag: Tag, entities: Entity[], { filterHidden = true } = {}) {
  const filterData = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));

  // @ts-ignore
  const closedFolders = entities.filter(
    (x) => x.type === 'tag' && TAG_FOLDER_TYPES[x.item.folder_type] === TAG_FOLDER_TYPES.CLOSED,
  );

  entities = entities.filter((sub) => {
    // Filter out all tags and and all who isn't tagged for this item
    if (sub.type === 'tag' || !entitiesFilter.isElementTagged(sub, tag.id)) {
      return false;
    }

    // Hide entities that are in a closed folder, unless the closed folder is opened or we display a closed folder
    if (
      filterHidden &&
      sub.type !== 'tag' &&
      TAG_FOLDER_TYPES[tag.folder_type] !== TAG_FOLDER_TYPES.CLOSED &&
      closedFolders.some((f) => entitiesFilter.isElementTagged(sub, f.id) && !filterData.selected.includes(f.id))
    ) {
      return false;
    }

    return true;
  });

  return entities;
}
