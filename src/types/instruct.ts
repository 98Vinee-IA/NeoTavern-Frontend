import { uuidv4 } from '../utils/commons';

export enum NamesBehavior {
  NONE = 'none',
  FORCE = 'force', // Always add name
  ALWAYS = 'always', // Same as force
  INCLUDE = 'include', // Only if not system
}

export interface InstructTemplate {
  id: string;
  name: string;

  // Sequences define the start of a turn for each role
  input_sequence: string; // For user
  output_sequence: string; // For assistant
  system_sequence: string; // For system

  // Suffixes define the end of a turn for each role
  input_suffix: string;
  output_suffix: string;
  system_suffix: string;

  // Sequence behavior
  first_output_sequence: string;
  last_output_sequence: string;
  last_system_sequence: string;
  first_input_sequence: string;
  last_input_sequence: string;

  // Stop sequences
  stop_sequence: string; // usually a single string in the JSON, but handled as array in logic
  sequences_as_stop_strings: boolean;

  // Behaviors
  wrap: boolean;
  macro: boolean;
  names_behavior: NamesBehavior | string;
  skip_examples: boolean;

  // Alignment
  user_alignment_message: string;
  system_same_as_user: boolean;
}

export function createDefaultInstructTemplate(): InstructTemplate {
  return {
    id: uuidv4(),
    name: 'New Template',
    input_sequence: 'User: ',
    output_sequence: 'Assistant: ',
    system_sequence: '',
    input_suffix: '\n',
    output_suffix: '\n',
    system_suffix: '\n',
    first_output_sequence: '',
    last_output_sequence: '',
    last_system_sequence: '',
    first_input_sequence: '',
    last_input_sequence: '',
    stop_sequence: '',
    sequences_as_stop_strings: true,
    wrap: true,
    macro: true,
    names_behavior: NamesBehavior.NONE,
    skip_examples: false,
    user_alignment_message: '',
    system_same_as_user: false,
  };
}
