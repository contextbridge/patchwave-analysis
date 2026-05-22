export interface Clock {
  now(): Date;
}

export class ClockImpl implements Clock {
  now(): Date {
    return new Date();
  }
}
