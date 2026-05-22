import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { GithubClient } from "../github/GithubClient.ts";
import type { GithubError } from "../github/errors.ts";

export type GithubCall =
  | { kind: "paginate"; route: string; params: Record<string, unknown> }
  | { kind: "request"; route: string; params: Record<string, unknown> }
  | { kind: "graphql"; query: string; variables: Record<string, unknown> };

type Outcome = { kind: "ok"; value: unknown } | { kind: "err"; error: GithubError };

interface ParamResponder {
  readonly route: string;
  readonly paramsMatcher: Record<string, unknown>;
  readonly outcome: Outcome;
  readonly label: string;
}

interface GraphqlResponder {
  readonly match: (query: string, variables: Record<string, unknown>) => boolean;
  readonly outcome: Outcome;
  readonly label: string;
}

export interface Stub {
  resolves(value: unknown): void;
  fails(error: GithubError): void;
}

/**
 * Records each GitHub call and returns scripted responses by (route, params).
 * Last matching responder wins, so tests can register a default and override
 * narrower cases on top.
 */
export class FakeGithubClient implements GithubClient {
  readonly calls: GithubCall[] = [];
  private readonly paginateResponders: ParamResponder[] = [];
  private readonly requestResponders: ParamResponder[] = [];
  private readonly graphqlResponders: GraphqlResponder[] = [];

  onPaginate(route: string, paramsMatcher: Record<string, unknown> = {}): Stub {
    return this.makeStub(this.paginateResponders, route, paramsMatcher);
  }

  onRequest(route: string, paramsMatcher: Record<string, unknown> = {}): Stub {
    return this.makeStub(this.requestResponders, route, paramsMatcher);
  }

  onGraphql(
    match: ((query: string, variables: Record<string, unknown>) => boolean) | string,
  ): Stub {
    const matcher =
      typeof match === "function" ? match : (q: string) => q.includes(match);
    const label = typeof match === "function" ? `onGraphql(<fn>)` : `onGraphql(${JSON.stringify(match)})`;
    return {
      resolves: (value) => this.graphqlResponders.push({ match: matcher, outcome: { kind: "ok", value }, label }),
      fails: (error) => this.graphqlResponders.push({ match: matcher, outcome: { kind: "err", error }, label }),
    };
  }

  paginate<T>(route: string, params: Record<string, unknown> = {}): ResultAsync<T[], GithubError> {
    this.calls.push({ kind: "paginate", route, params });
    return this.respond<T[]>(this.paginateResponders, "paginate", route, params);
  }

  request<T>(route: string, params: Record<string, unknown> = {}): ResultAsync<T, GithubError> {
    this.calls.push({ kind: "request", route, params });
    return this.respond<T>(this.requestResponders, "request", route, params);
  }

  graphql<T>(query: string, variables: Record<string, unknown> = {}): ResultAsync<T, GithubError> {
    this.calls.push({ kind: "graphql", query, variables });
    const responder = this.graphqlResponders.findLast((r) => r.match(query, variables));
    if (!responder) {
      throw new Error(
        `FakeGithubClient: no responder for graphql call. Registered: ${formatList(
          this.graphqlResponders.map((r) => r.label),
        )}`,
      );
    }
    return responder.outcome.kind === "ok"
      ? okAsync(responder.outcome.value as T)
      : errAsync(responder.outcome.error);
  }

  callsTo(kind: GithubCall["kind"]): GithubCall[] {
    return this.calls.filter((c) => c.kind === kind);
  }

  private makeStub(
    bucket: ParamResponder[],
    route: string,
    paramsMatcher: Record<string, unknown>,
  ): Stub {
    const label = `${route} ${JSON.stringify(paramsMatcher)}`;
    return {
      resolves: (value) => bucket.push({ route, paramsMatcher, outcome: { kind: "ok", value }, label }),
      fails: (error) => bucket.push({ route, paramsMatcher, outcome: { kind: "err", error }, label }),
    };
  }

  private respond<T>(
    bucket: ParamResponder[],
    kind: string,
    route: string,
    params: Record<string, unknown>,
  ): ResultAsync<T, GithubError> {
    const responder = bucket.findLast(
      (r) => r.route === route && matchesParams(r.paramsMatcher, params),
    );
    if (!responder) {
      throw new Error(
        `FakeGithubClient: no ${kind} responder for \`${route}\` with params ${JSON.stringify(
          params,
        )}. Registered: ${formatList(bucket.map((r) => r.label))}`,
      );
    }
    return responder.outcome.kind === "ok"
      ? okAsync(responder.outcome.value as T)
      : errAsync(responder.outcome.error);
  }
}

function matchesParams(
  matcher: Record<string, unknown>,
  actual: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(matcher)) {
    if (actual[key] !== expected) return false;
  }
  return true;
}

function formatList(labels: readonly string[]): string {
  if (labels.length === 0) return "(none)";
  return labels.map((l, i) => `\n  ${i + 1}. ${l}`).join("");
}
