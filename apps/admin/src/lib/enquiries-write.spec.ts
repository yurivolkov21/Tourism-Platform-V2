import { ORPCError } from '@orpc/client';
import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  ADD_NOTE_CONTRACT_CODES,
  addNoteErrorCopy,
  classifyAddNoteError,
  classifySetStatusError,
  isAddNoteStale,
  isSetStatusStale,
  SET_STATUS_CONTRACT_CODES,
  setStatusConfirmRows,
  setStatusDialogCopy,
  setStatusErrorCopy,
} from './enquiries-write';

/**
 * Logic THUẦN của HAI hành vi ghi vùng enquiries (spec P4c §3-F9): tập mã
 * contract, phân loại lỗi, câu chữ, và copy dialog dựng sẵn để component
 * không tự ghép chuỗi.
 */
const t = messages.admin.enquiries;

describe('tập mã contract', () => {
  it('setStatus đúng bằng errorMap của admin.enquiries.setStatus', () => {
    expect([...SET_STATUS_CONTRACT_CODES].sort()).toEqual(
      Object.keys(contract.admin.enquiries.setStatus['~orpc'].errorMap ?? {}).sort(),
    );
  });

  it('addNote đúng bằng errorMap của admin.enquiries.addNote', () => {
    expect([...ADD_NOTE_CONTRACT_CODES].sort()).toEqual(
      Object.keys(contract.admin.enquiries.addNote['~orpc'].errorMap ?? {}).sort(),
    );
  });
});

describe('classify', () => {
  it('NOT_FOUND do CONTRACT khai → mã contract; trùng tên mà không có con dấu → GENERIC', () => {
    expect(classifySetStatusError(new ORPCError('NOT_FOUND', { status: 404, defined: true }))).toBe(
      'NOT_FOUND',
    );
    expect(classifySetStatusError(new ORPCError('NOT_FOUND', { status: 404 }))).toBe('GENERIC');
    expect(classifyAddNoteError(new ORPCError('NOT_FOUND', { status: 404, defined: true }))).toBe(
      'NOT_FOUND',
    );
  });

  it('401/403 → hết phiên / mất quyền; lỗi mạng → GENERIC', () => {
    expect(classifySetStatusError(new ORPCError('UNAUTHORIZED', { status: 401 }))).toBe(
      'UNAUTHORIZED',
    );
    expect(classifyAddNoteError(new ORPCError('FORBIDDEN', { status: 403 }))).toBe('FORBIDDEN');
    expect(classifyAddNoteError(new TypeError('fetch failed'))).toBe('GENERIC');
  });
});

describe('trạng-thái-cũ', () => {
  it('NOT_FOUND của CẢ HAI lệnh là trạng-thái-cũ: đóng dialog/ô nhập + refresh, không mời bấm lại', () => {
    expect(isSetStatusStale('NOT_FOUND')).toBe(true);
    expect(isAddNoteStale('NOT_FOUND')).toBe(true);
  });

  it('mã transport KHÔNG phải trạng-thái-cũ — hết phiên thì đăng nhập lại rồi thử tại chỗ', () => {
    expect(isSetStatusStale('UNAUTHORIZED')).toBe(false);
    expect(isAddNoteStale('GENERIC')).toBe(false);
  });
});

describe('câu chữ', () => {
  it('mã contract lấy từ khối i18n của chính lệnh đó, mã transport dùng giọng ghi chung', () => {
    expect(setStatusErrorCopy('NOT_FOUND')).toBe(t.setStatus.errors.NOT_FOUND);
    expect(addNoteErrorCopy('NOT_FOUND')).toBe(t.addNote.errors.NOT_FOUND);
    // Hai lệnh KHÔNG dùng chung một câu: mất trạng thái khác mất một note.
    expect(setStatusErrorCopy('NOT_FOUND')).not.toBe(addNoteErrorCopy('NOT_FOUND'));
    expect(setStatusErrorCopy('UNAUTHORIZED')).toBe(messages.admin.errors.write.UNAUTHORIZED);
    expect(addNoteErrorCopy('GENERIC')).toBe(messages.admin.errors.write.GENERIC);
  });
});

describe('setStatusDialogCopy', () => {
  it('mọi khe của kit ConfirmWriteDialog có chữ, và KHÔNG có ô note (lệnh này không mang ghi chú)', () => {
    const copy = setStatusDialogCopy();
    expect(copy).toEqual({
      title: t.setStatus.dialog.title,
      body: t.setStatus.dialog.body,
      warning: t.setStatus.dialog.warning,
      submit: t.setStatus.dialog.submit,
      submitting: t.setStatus.dialog.submitting,
      cancel: t.setStatus.cancel,
    });
    expect(copy).not.toHaveProperty('noteLabel');
  });

  it('câu cảnh báo nói thẳng hệ quả không đảo ngược được (audit append-only)', () => {
    expect(setStatusDialogCopy().warning).toMatch(/append-only/i);
  });
});

describe('setStatusConfirmRows', () => {
  it('ba dòng ngữ cảnh: lead nào, TỪ đâu, TỚI đâu — bằng NHÃN, không phải enum thô', () => {
    expect(setStatusConfirmRows({ name: 'Ada Lovelace', from: 'NEW', to: 'WON' })).toEqual([
      { label: t.setStatus.lead, value: 'Ada Lovelace' },
      { label: t.setStatus.from, value: t.status.NEW },
      { label: t.setStatus.to, value: t.status.WON },
    ]);
  });

  it('chuyển lùi cũng nêu đúng chiều — dialog là lớp bảo vệ duy nhất (chuyển tự do)', () => {
    const rows = setStatusConfirmRows({ name: 'Grace', from: 'WON', to: 'LOST' });
    expect(rows.map((row) => row.value)).toEqual(['Grace', t.status.WON, t.status.LOST]);
  });
});
