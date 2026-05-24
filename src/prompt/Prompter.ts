import * as clack from '@clack/prompts';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import { toError } from '../errors.ts';

export type PromptError = { kind: 'cancelled' } | { kind: 'internal'; message: string };

export interface SelectChoice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
}

export interface ConfirmOptions {
  readonly message: string;
  readonly defaultValue?: boolean;
}

export interface SelectOptions<T extends string> {
  readonly message: string;
  readonly choices: readonly SelectChoice<T>[];
  readonly initialValue?: T;
}

export interface TextOptions {
  readonly message: string;
  readonly placeholder?: string;
  readonly defaultValue?: string;
  /** Return a string to reject the input (the string is shown as the error). */
  readonly validate?: (value: string) => string | undefined;
}

export interface PromptSpinner {
  start(msg?: string): void;
  stop(msg?: string): void;
}

export interface Prompter {
  intro(msg: string): void;
  outro(msg: string): void;
  note(msg: string, title?: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  confirm(opts: ConfirmOptions): ResultAsync<boolean, PromptError>;
  select<T extends string>(opts: SelectOptions<T>): ResultAsync<T, PromptError>;
  text(opts: TextOptions): ResultAsync<string, PromptError>;
  spinner(): PromptSpinner;
}

function wrap<T>(p: Promise<T | symbol>): ResultAsync<T, PromptError> {
  return ResultAsync.fromPromise(p, (e): PromptError => ({ kind: 'internal', message: toError(e).message })).andThen(
    (value) =>
      clack.isCancel(value) ? errAsync<T, PromptError>({ kind: 'cancelled' }) : okAsync<T, PromptError>(value),
  );
}

export class PrompterImpl implements Prompter {
  intro(msg: string): void {
    clack.intro(msg);
  }

  outro(msg: string): void {
    clack.outro(msg);
  }

  note(msg: string, title?: string): void {
    clack.note(msg, title);
  }

  info(msg: string): void {
    clack.log.info(msg);
  }

  warn(msg: string): void {
    clack.log.warn(msg);
  }

  error(msg: string): void {
    clack.log.error(msg);
  }

  confirm(opts: ConfirmOptions): ResultAsync<boolean, PromptError> {
    return wrap(clack.confirm({ message: opts.message, initialValue: opts.defaultValue }));
  }

  select<T extends string>(opts: SelectOptions<T>): ResultAsync<T, PromptError> {
    const options = opts.choices.map((c) => {
      const option: { value: T; label: string; hint?: string } = { value: c.value, label: c.label };
      if (c.hint !== undefined) option.hint = c.hint;
      return option;
    }) as Parameters<typeof clack.select<T>>[0]['options'];
    return wrap(clack.select<T>({ message: opts.message, initialValue: opts.initialValue, options }));
  }

  text(opts: TextOptions): ResultAsync<string, PromptError> {
    return wrap(
      clack.text({
        message: opts.message,
        placeholder: opts.placeholder,
        defaultValue: opts.defaultValue,
        validate: opts.validate ? (value) => opts.validate?.(value ?? '') : undefined,
      }),
    );
  }

  spinner(): PromptSpinner {
    const s = clack.spinner();
    return { start: (m) => s.start(m), stop: (m) => s.stop(m) };
  }
}

export function formatPromptError(err: PromptError): string {
  switch (err.kind) {
    case 'cancelled':
      return 'cancelled by user';
    case 'internal':
      return `prompt failed: ${err.message}`;
  }
}
