import type { Clock } from '../Clock.ts';
import { type Instant, instantFromString } from '../time.ts';

export class FakeClock implements Clock {
  private current: Instant;

  constructor(initial: Instant | string = '2026-05-22T00:00:00Z') {
    this.current = typeof initial === 'string' ? instantFromString(initial) : initial;
  }

  now(): Instant {
    return this.current;
  }
}
