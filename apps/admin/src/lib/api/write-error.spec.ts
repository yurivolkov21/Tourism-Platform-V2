import { describe, expect, it } from 'vitest';
import { createWriteErrorCodec } from './write-error';

/**
 * `createWriteErrorCodec` — tập mã, câu chữ và (từ vòng vá review F7) cả luật
 * TRẠNG-THÁI-CŨ đều derive từ MỘT khối i18n: ba vùng từng tự viết
 * `isStaleStateCode` tay, thêm mã vào i18n thì codec biết mà predicate không.
 */
const ERRORS = {
  NOT_FOUND: 'Gone.',
  ALREADY_DONE: 'Someone did it first.',
  PROVIDER_DOWN: 'Try again in a minute.',
} as const;

describe('createWriteErrorCodec', () => {
  it('codes = đúng các khoá i18n; copy tra theo mã, mã transport dùng câu chung', () => {
    const codec = createWriteErrorCodec(ERRORS);
    expect([...codec.codes].sort()).toEqual(['ALREADY_DONE', 'NOT_FOUND', 'PROVIDER_DOWN']);
    expect(codec.copy('NOT_FOUND')).toBe('Gone.');
    expect(codec.copy('GENERIC')).not.toBe('');
  });

  it('isStale theo đúng danh sách vùng khai — mã ngoài danh sách (kể cả transport) là false', () => {
    const codec = createWriteErrorCodec(ERRORS, { stale: ['NOT_FOUND', 'ALREADY_DONE'] });
    expect(codec.isStale('NOT_FOUND')).toBe(true);
    expect(codec.isStale('ALREADY_DONE')).toBe(true);
    expect(codec.isStale('PROVIDER_DOWN')).toBe(false);
    expect(codec.isStale('GENERIC')).toBe(false);
    expect(codec.isStale('UNAUTHORIZED')).toBe(false);
  });

  it('không khai stale → không mã nào là trạng-thái-cũ', () => {
    expect(createWriteErrorCodec(ERRORS).isStale('NOT_FOUND')).toBe(false);
  });
});
