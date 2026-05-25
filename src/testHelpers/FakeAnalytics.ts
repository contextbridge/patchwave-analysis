import type { Analytics } from '../Analytics.ts';

export interface CaptureCall {
  readonly event: string;
  readonly properties?: Record<string, unknown>;
}

export class FakeAnalytics implements Analytics {
  readonly captureCalls: CaptureCall[] = [];
  readonly registered: Record<string, unknown> = {};

  identify(_distinctId: string, _properties?: Record<string, unknown>): void {}

  capture(event: string, properties?: Record<string, unknown>): void {
    // Mirror AnalyticsImpl: registered super-properties are merged onto every captured event.
    const merged = Object.keys(this.registered).length > 0 ? { ...this.registered, ...properties } : properties;
    this.captureCalls.push({ event, properties: merged });
  }

  register(properties: Record<string, unknown>): void {
    Object.assign(this.registered, properties);
  }

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
