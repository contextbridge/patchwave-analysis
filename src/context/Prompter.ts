import * as clack from '@clack/prompts';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import { toError } from '../errors.ts';

export type PromptError = { kind: 'cancelled' } | { kind: 'internal'; message: string };

export interface SelectChoice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
}

export interface MultiSelectOptions<T extends string> {
  readonly message: string;
  readonly choices: readonly SelectChoice<T>[];
  readonly initialValues?: readonly T[];
  readonly required?: boolean;
  readonly maxItems?: number;
  readonly placeholder?: string;
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
  clear(): void;
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
  multiSelect<T extends string>(opts: MultiSelectOptions<T>): ResultAsync<T[], PromptError>;
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
    return wrap(
      clack.select<T>({
        message: opts.message,
        initialValue: opts.initialValue,
        options: toClackOptions(opts.choices) as Parameters<typeof clack.select<T>>[0]['options'],
      }),
    );
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

  multiSelect<T extends string>(opts: MultiSelectOptions<T>): ResultAsync<T[], PromptError> {
    const options = toClackOptions(opts.choices) as unknown as Parameters<
      typeof clack.autocompleteMultiselect<T>
    >[0]['options'];

    return wrap(
      clack.autocompleteMultiselect<T>({
        message: opts.message,
        options,
        initialValues: [...(opts.initialValues ?? [])],
        required: opts.required,
        maxItems: opts.maxItems,
        placeholder: opts.placeholder,
      }),
    );
  }

  spinner(): PromptSpinner {
    const s = clack.spinner();
    return { start: (m) => s.start(m), stop: (m) => s.stop(m), clear: () => s.clear() };
  }
}

function toClackOptions<T extends string>(choices: readonly SelectChoice<T>[]) {
  return choices.map((c) => {
    const option: { value: T; label: string; hint?: string } = { value: c.value, label: c.label };
    if (c.hint !== undefined) option.hint = c.hint;
    return option;
  });
}

export function formatPromptError(err: PromptError): string {
  switch (err.kind) {
    case 'cancelled':
      return 'cancelled by user';
    case 'internal':
      return `prompt failed: ${err.message}`;
  }
}
