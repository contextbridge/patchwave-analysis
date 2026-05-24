import { Factory } from 'fishery';
import { type FakeContextHandle, createFakeContext } from './createFakeContext.ts';
import { FakeClock } from './FakeClock.ts';

export const fakeContextHandle = Factory.define<FakeContextHandle>(() =>
  createFakeContext({
    overrides: { clock: new FakeClock('2026-05-22T12:00:00Z'), appVersion: '0.0.1' },
  }),
);
