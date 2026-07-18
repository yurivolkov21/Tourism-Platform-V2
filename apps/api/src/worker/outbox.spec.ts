import { OutboxStatus } from '../generated/prisma/enums.js';
import { MAX_ATTEMPTS, nextAttemptState, trimError } from './outbox.service.js';

// Unit — logic thuần của state machine retry (stateful paths ở outbox.int.spec.ts).

describe('nextAttemptState', () => {
  it('increments attempts and stays PENDING below MAX_ATTEMPTS', () => {
    expect(nextAttemptState(0)).toEqual({ attempts: 1, status: OutboxStatus.PENDING });
    expect(nextAttemptState(3)).toEqual({ attempts: 4, status: OutboxStatus.PENDING });
  });

  it(`parks FAILED when attempts reach MAX_ATTEMPTS (${MAX_ATTEMPTS})`, () => {
    expect(nextAttemptState(MAX_ATTEMPTS - 1)).toEqual({
      attempts: MAX_ATTEMPTS,
      status: OutboxStatus.FAILED,
    });
    // Phòng thủ: đã quá trần (row cũ từ trước khi hạ MAX_ATTEMPTS) vẫn FAILED.
    expect(nextAttemptState(MAX_ATTEMPTS + 3).status).toBe(OutboxStatus.FAILED);
  });
});

describe('trimError', () => {
  it('uses Error message as-is when short', () => {
    expect(trimError(new Error('smtp boom'))).toBe('smtp boom');
  });

  it('stringifies non-Error throwables', () => {
    expect(trimError('raw string')).toBe('raw string');
    expect(trimError(42)).toBe('42');
    expect(trimError(undefined)).toBe('undefined');
  });

  it('trims to 1000 chars (last_error column cap)', () => {
    const long = 'x'.repeat(2500);
    expect(trimError(new Error(long))).toHaveLength(1000);
  });
});
