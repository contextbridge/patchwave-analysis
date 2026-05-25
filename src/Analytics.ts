export interface Analytics {
  identify(distinctId: string, properties?: Record<string, unknown>): void;
  capture(event: string, properties?: Record<string, unknown>): void;
  register(properties: Record<string, unknown>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export class NoopAnalytics implements Analytics {
  identify(_distinctId: string, _properties?: Record<string, unknown>): void {}
  capture(_event: string, _properties?: Record<string, unknown>): void {}
  register(_properties: Record<string, unknown>): void {}
  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

export function createNoopAnalytics(): Analytics {
  return new NoopAnalytics();
}
