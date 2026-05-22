import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import type {
  ConfirmOptions,
  PromptError,
  PromptSpinner,
  Prompter,
  SelectOptions,
  TextOptions,
} from '../prompt/Prompter.ts';

type AnswerKind = 'confirm' | 'select' | 'text';

interface ScriptedAnswer<K extends AnswerKind, V> {
  readonly kind: K;
  readonly value: V | PromptError;
}

type ConfirmAnswer = ScriptedAnswer<'confirm', boolean>;
type SelectAnswer = ScriptedAnswer<'select', string>;
type TextAnswer = ScriptedAnswer<'text', string>;
type Answer = ConfirmAnswer | SelectAnswer | TextAnswer;

export interface SpinnerEvent {
  readonly type: 'start' | 'stop';
  readonly message?: string;
}

export class FakePrompter implements Prompter {
  readonly intros: string[] = [];
  readonly outros: string[] = [];
  readonly notes: { message: string; title?: string }[] = [];
  readonly infos: string[] = [];
  readonly warns: string[] = [];
  readonly errors: string[] = [];
  readonly confirms: ConfirmOptions[] = [];
  readonly selects: SelectOptions<string>[] = [];
  readonly texts: TextOptions[] = [];
  readonly spinnerEvents: SpinnerEvent[] = [];

  readonly #answers: Answer[] = [];

  scriptConfirm(value: boolean | PromptError): this {
    this.#answers.push({ kind: 'confirm', value });
    return this;
  }

  scriptSelect(value: string | PromptError): this {
    this.#answers.push({ kind: 'select', value });
    return this;
  }

  scriptText(value: string | PromptError): this {
    this.#answers.push({ kind: 'text', value });
    return this;
  }

  intro(msg: string): void {
    this.intros.push(msg);
  }

  outro(msg: string): void {
    this.outros.push(msg);
  }

  note(msg: string, title?: string): void {
    this.notes.push({ message: msg, title });
  }

  info(msg: string): void {
    this.infos.push(msg);
  }

  warn(msg: string): void {
    this.warns.push(msg);
  }

  error(msg: string): void {
    this.errors.push(msg);
  }

  confirm(opts: ConfirmOptions): ResultAsync<boolean, PromptError> {
    this.confirms.push(opts);
    const next = this.#shift('confirm');
    if (isPromptError(next.value)) return errAsync(next.value);
    return okAsync(next.value);
  }

  select<T extends string>(opts: SelectOptions<T>): ResultAsync<T, PromptError> {
    this.selects.push(opts);
    const next = this.#shift('select');
    if (isPromptError(next.value)) return errAsync(next.value);
    return okAsync(next.value as T);
  }

  text(opts: TextOptions): ResultAsync<string, PromptError> {
    this.texts.push(opts);
    const next = this.#shift('text');
    if (isPromptError(next.value)) return errAsync(next.value);
    return okAsync(next.value);
  }

  spinner(): PromptSpinner {
    return {
      start: (message?: string) => {
        this.spinnerEvents.push({ type: 'start', message });
      },
      stop: (message?: string) => {
        this.spinnerEvents.push({ type: 'stop', message });
      },
    };
  }

  #shift<K extends AnswerKind>(expected: K): Extract<Answer, { kind: K }> {
    const next = this.#answers.shift();
    if (next === undefined) {
      throw new Error(`FakePrompter: ran out of scripted answers (expected ${expected})`);
    }
    if (next.kind !== expected) {
      throw new Error(`FakePrompter: expected ${expected} answer, got scripted ${next.kind}`);
    }
    return next as Extract<Answer, { kind: K }>;
  }
}

function isPromptError(value: unknown): value is PromptError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}
