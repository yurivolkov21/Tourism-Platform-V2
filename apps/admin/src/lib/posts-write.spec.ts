import { ORPCError } from '@orpc/client';
import { contract, POST_SLUG_MAX, POST_TITLE_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  CREATE_POST_CONTRACT_CODES,
  DELETE_POST_CONTRACT_CODES,
  isDeletePostStale,
  missingTourIdsOf,
  postCreatePayload,
  SIGN_COVER_CONTRACT_CODES,
  UPDATE_POST_CONTRACT_CODES,
  validatePostCreateForm,
} from './posts-write';

const fe = messages.admin.posts.editor.form.errors;
const codes = (errorMap: object) => Object.keys(errorMap).sort();

describe('tập mã lỗi khớp contract (codec derive từ i18n, không từ contract)', () => {
  it('hộp New post phủ ĐÚNG các mã `admin.posts.create` khai', () => {
    expect([...CREATE_POST_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.posts.create['~orpc'].errorMap),
    );
  });

  it('lưu bài phủ ĐÚNG các mã `admin.posts.update` khai', () => {
    expect([...UPDATE_POST_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.posts.update['~orpc'].errorMap),
    );
  });

  it('ký ảnh bìa phủ ĐÚNG các mã `admin.posts.signCoverUpload` khai', () => {
    expect([...SIGN_COVER_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.posts.signCoverUpload['~orpc'].errorMap),
    );
  });

  it('xoá bài phủ ĐÚNG các mã `admin.posts.delete` khai', () => {
    expect([...DELETE_POST_CONTRACT_CODES].sort()).toEqual(
      codes(contract.admin.posts.delete['~orpc'].errorMap),
    );
  });

  it('xoá: cả hai mã đều là trạng-thái-cũ; lỗi vận chuyển thì không', () => {
    expect(isDeletePostStale('STALE_POST')).toBe(true);
    expect(isDeletePostStale('NOT_FOUND')).toBe(true);
    expect(isDeletePostStale('GENERIC')).toBe(false);
  });
});

describe('hộp New post', () => {
  it('trống thì cả hai ô báo "Fill this in"', () => {
    expect(validatePostCreateForm({ title: '  ', slug: '' })).toEqual({
      title: fe.required,
      slug: fe.required,
    });
  });

  it('trần tiêu đề và slug của contract', () => {
    expect(
      validatePostCreateForm({
        title: 'x'.repeat(POST_TITLE_MAX + 1),
        slug: 'a'.repeat(POST_SLUG_MAX + 1),
      }),
    ).toEqual({ title: fe.tooLong(POST_TITLE_MAX), slug: fe.tooLong(POST_SLUG_MAX) });
    expect(
      validatePostCreateForm({
        title: 'x'.repeat(POST_TITLE_MAX),
        slug: 'a'.repeat(POST_SLUG_MAX),
      }),
    ).toEqual({});
  });

  it('slug sai hình dạng', () => {
    expect(validatePostCreateForm({ title: 'A', slug: 'Bad Slug' }).slug).toBe(fe.slugShape);
  });

  // Vòng review P4e-4: ba form slug còn lại (tour, địa danh, danh mục) xét hình dạng TRƯỚC độ
  // dài — cùng một slug sai cả hai thì bốn form phải nói cùng một câu.
  it('slug vừa dài quá trần vừa sai hình dạng: báo hình dạng trước, như các form slug khác', () => {
    expect(
      validatePostCreateForm({ title: 'A', slug: `Bad Slug ${'a'.repeat(POST_SLUG_MAX)}` }).slug,
    ).toBe(fe.slugShape);
  });

  it('payload cắt khoảng trắng hai ô', () => {
    expect(postCreatePayload({ title: '  Tea  ', slug: ' tea ' })).toEqual({
      title: 'Tea',
      slug: 'tea',
    });
  });
});

describe('missingTourIdsOf (vòng review P4e-4)', () => {
  const GONE = '7a1b2c3d-0000-4000-8000-0000000000e1';

  it('RELATED_TOUR_NOT_FOUND đã khai, có data: đúng các tour đã mất', () => {
    const error = new ORPCError('RELATED_TOUR_NOT_FOUND', {
      status: 404,
      defined: true,
      data: { tourIds: [GONE] },
    });
    expect(missingTourIdsOf(error)).toEqual([GONE]);
  });

  it('không có data, mã khác, lỗi chưa khai hay lỗi lạ: rỗng — form rơi về câu chung', () => {
    expect(
      missingTourIdsOf(new ORPCError('RELATED_TOUR_NOT_FOUND', { status: 404, defined: true })),
    ).toEqual([]);
    expect(
      missingTourIdsOf(
        new ORPCError('NOT_FOUND', { status: 404, defined: true, data: { tourIds: [GONE] } }),
      ),
    ).toEqual([]);
    expect(
      missingTourIdsOf(
        new ORPCError('RELATED_TOUR_NOT_FOUND', { status: 404, data: { tourIds: [GONE] } }),
      ),
    ).toEqual([]);
    expect(missingTourIdsOf(new Error('boom'))).toEqual([]);
  });
});
