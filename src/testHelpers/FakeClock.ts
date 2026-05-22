import type { Clock } from "../Clock.ts";

export class FakeClock implements Clock {
  private current: Date;

  constructor(initial: Date | string = "2026-05-22T00:00:00Z") {
    this.current = typeof initial === "string" ? new Date(initial) : new Date(initial);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(next: Date | string): void {
    this.current = typeof next === "string" ? new Date(next) : new Date(next);
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
