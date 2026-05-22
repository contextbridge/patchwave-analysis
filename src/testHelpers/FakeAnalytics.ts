import type { Analytics } from '../Analytics.ts';

export interface IdentifyCall {
  readonly distinctId: string;
  readonly properties?: Record<string, unknown>;
}

export interface CaptureCall {
  readonly event: string;
  readonly properties?: Record<string, unknown>;
}

export class FakeAnalytics implements Analytics {
  readonly identifyCalls: IdentifyCall[] = [];
  readonly captureCalls: CaptureCall[] = [];
  readonly registered: Record<string, unknown> = {};
  flushCount = 0;
  shutdownCount = 0;

  identify(distinctId: string, properties?: Record<string, unknown>): void {
    this.identifyCalls.push({ distinctId, properties });
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    this.captureCalls.push({ event, properties });
  }

  register(properties: Record<string, unknown>): void {
    Object.assign(this.registered, properties);
  }

  flush(): Promise<void> {
    this.flushCount += 1;
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    this.shutdownCount += 1;
    return Promise.resolve();
  }

  capturedEvents(name: string): CaptureCall[] {
    return this.captureCalls.filter((c) => c.event === name);
  }
}
