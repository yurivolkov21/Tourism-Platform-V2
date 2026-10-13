import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  isUserWriteStale,
  USER_WRITE_CONTRACT_CODES,
  userConfirmRows,
  userWriteErrorCopy,
} from './users-write';

const t = messages.admin.users;

describe('codec lỗi của bốn lệnh ghi Users', () => {
  it('tập mã khớp errorMap của CẢ bốn thủ tục', () => {
    for (const procedure of [
      contract.admin.users.setRole,
      contract.admin.users.lock,
      contract.admin.users.unlock,
      contract.admin.users.revokeSessions,
    ]) {
      expect([...USER_WRITE_CONTRACT_CODES].sort()).toEqual(
        Object.keys(procedure['~orpc'].errorMap).sort(),
      );
    }
  });

  it('cả hai mã contract là trạng-thái-cũ; mã transport thì không', () => {
    expect(isUserWriteStale('NOT_FOUND')).toBe(true);
    expect(isUserWriteStale('STATE_CHANGED')).toBe(true);
    expect(isUserWriteStale('UNAUTHORIZED')).toBe(false);
    expect(isUserWriteStale('GENERIC')).toBe(false);
  });

  it('mỗi mã một câu; FORBIDDEN dùng câu ghi chung của admin', () => {
    expect(userWriteErrorCopy('STATE_CHANGED')).toBe(t.errors.STATE_CHANGED);
    expect(userWriteErrorCopy('FORBIDDEN')).toBe(messages.admin.errors.write.FORBIDDEN);
  });
});

describe('userConfirmRows', () => {
  it('tên rồi email — thứ phải đọc lại trước khi bấm', () => {
    expect(userConfirmRows({ name: 'Ada Lovelace', email: 'ada@example.com' })).toEqual([
      { label: t.actions.rows.user, value: 'Ada Lovelace' },
      { label: t.actions.rows.email, value: 'ada@example.com' },
    ]);
  });
});
