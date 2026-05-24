import { type Instant, nowInstant } from './time.ts';

export interface Clock {
  now(): Instant;
}

export class ClockImpl implements Clock {
  now(): Instant {
    return nowInstant();
  }
}
