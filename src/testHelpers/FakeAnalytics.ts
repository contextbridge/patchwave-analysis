import type { Analytics } from '../Analytics.ts';

export interface CaptureCall {
  readonly event: string;
  readonly properties?: Record<string, unknown>;
}

export class FakeAnalytics implements Analytics {
  readonly captureCalls: CaptureCall[] = [];

  identify(_distinctId: string, _properties?: Record<string, unknown>): void {}

  capture(event: string, properties?: Record<string, unknown>): void {
    this.captureCalls.push({ event, properties });
  }

  register(_properties: Record<string, unknown>): void {}

  flush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  capturedEvents(name: string): CaptureCall[] {
    return this.captureCalls.filter((c) => c.event === name);
  }
}
