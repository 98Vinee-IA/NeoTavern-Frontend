import type { Character, ChatMessage } from '../types';
import { getMessageTimeStamp } from './date';

// TODO: Implement regex string substitution similar to original
function getRegexedString(str: string): string {
  // For now, this is a placeholder. A full implementation would substitute
  // variables like {{char}}, {{user}}, etc., and apply custom regex rules.
  return str;
}

export function getFirstMessage(character: Character): ChatMessage {
  const firstMes = character?.first_mes || '';
  const alternateGreetings = character?.data?.alternate_greetings;

  const message: ChatMessage = {
    name: character.name,
    is_user: false,
    is_system: false,
    send_date: getMessageTimeStamp(),
    mes: getRegexedString(firstMes),
    extra: {},
  };

  if (Array.isArray(alternateGreetings) && alternateGreetings.length > 0) {
    const swipes = [message.mes, ...alternateGreetings.map((greeting) => getRegexedString(greeting))];

    if (!message.mes) {
      swipes.shift();
      message.mes = swipes[0] ?? ''; // Ensure message isn't undefined
    }

    message.swipe_id = 0;
    message.swipes = swipes.filter(Boolean); // Filter out any empty greetings
    message.swipe_info = message.swipes.map(() => ({
      send_date: message.send_date,
      gen_started: undefined,
      gen_finished: undefined,
      extra: {},
    }));
  }

  return message;
}
