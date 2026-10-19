import { describe, expect, it } from 'vitest';
import {
  AdminMediaUpdateInputSchema,
  isCcByLicense,
  MEDIA_LICENSE_URL_MAX,
  MEDIA_SOURCE_URL_MAX,
  mediaAltRequired,
  mediaAttention,
} from './admin-media.js';

/**
 * Luật dùng chung hai phía của Media library (ADR-0060 §1, §3): API chặn lưu theo nó, admin lọc
 * và cảnh báo theo nó — một bản, không lệch.
 */
describe('isCcByLicense — họ giấy phép đòi tác giả và link giấy phép', () => {
  it.each([
    'CC BY 2.0',
    'CC BY-SA 3.0 de',
    'CC BY-NC 4.0',
    'cc by 4.0',
    'CC-BY 4.0',
    '  CC BY-SA 4.0',
  ])('nhận "%s"', (license) => {
    expect(isCcByLicense(license)).toBe(true);
  });

  it.each([null, '', 'CC0', 'CC0 1.0', 'Unsplash License', 'Unsplash+', 'Public domain', 'CCBY'])(
    'không nhận %j',
    (license) => {
      expect(isCcByLicense(license)).toBe(false);
    },
  );
});

describe('mediaAltRequired — alt bắt buộc khi ảnh nằm ở tour hay thư viện', () => {
  it('tour hay điểm đến: bắt buộc', () => {
    expect(mediaAltRequired(['TOUR'])).toBe(true);
    expect(mediaAltRequired(['POST', 'DESTINATION'])).toBe(true);
  });

  it('chỉ bài viết hay khe site: ảnh trang trí, được để trống', () => {
    expect(mediaAltRequired(['POST'])).toBe(false);
    expect(mediaAltRequired(['SITE', 'POST'])).toBe(false);
    expect(mediaAltRequired([])).toBe(false);
  });
});

describe('mediaAttention — việc cần chú ý của một ảnh', () => {
  const clean = {
    altRequired: true,
    alts: ['A boat on the river'],
    author: 'Jane Doe',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  };

  it('đủ cả: không có gì', () => {
    expect(mediaAttention(clean)).toEqual([]);
  });

  it('alt bắt buộc mà một dòng để trống hay toàn khoảng trắng: MISSING_ALT', () => {
    expect(mediaAttention({ ...clean, alts: ['A boat', null] })).toEqual(['MISSING_ALT']);
    expect(mediaAttention({ ...clean, alts: ['   '] })).toEqual(['MISSING_ALT']);
  });

  it('alt không bắt buộc: dòng trống không phải việc cần chú ý', () => {
    expect(mediaAttention({ ...clean, altRequired: false, alts: [null] })).toEqual([]);
  });

  it('CC BY thiếu link giấy phép hay thiếu tác giả: CREDIT_INCOMPLETE', () => {
    expect(mediaAttention({ ...clean, licenseUrl: null })).toEqual(['CREDIT_INCOMPLETE']);
    expect(mediaAttention({ ...clean, author: '' })).toEqual(['CREDIT_INCOMPLETE']);
  });

  it('giấy phép khác họ CC BY thiếu link: không phải việc cần chú ý', () => {
    expect(mediaAttention({ ...clean, license: 'Unsplash License', licenseUrl: null })).toEqual([]);
    expect(mediaAttention({ ...clean, license: null, author: null, licenseUrl: null })).toEqual([]);
  });

  it('cả hai cùng lúc: thứ tự cố định', () => {
    expect(mediaAttention({ ...clean, alts: [null], licenseUrl: null })).toEqual([
      'MISSING_ALT',
      'CREDIT_INCOMPLETE',
    ]);
  });
});

describe('AdminMediaUpdateInputSchema', () => {
  const base = {
    publicId: 'tourism/catalog/destination/hoi-an/1',
    version: '6:2026-10-19T03:00:00.000Z',
    alt: 'Lanterns over the river',
    author: 'Jane Doe',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lanterns.jpg',
  };

  it('chuỗi rỗng hay toàn khoảng trắng thành null, chữ được cắt khoảng trắng', () => {
    const parsed = AdminMediaUpdateInputSchema.parse({
      ...base,
      alt: '  Lanterns  ',
      author: '',
      license: '   ',
      licenseUrl: '',
      sourceUrl: '  ',
    });
    expect(parsed).toMatchObject({
      alt: 'Lanterns',
      author: null,
      license: null,
      licenseUrl: null,
      sourceUrl: null,
    });
  });

  it.each(['javascript:alert(1)', 'ftp://example.com/x', 'not a url', 'data:text/html,hi'])(
    'link không phải http hay https bị từ chối: %s',
    (link) => {
      expect(AdminMediaUpdateInputSchema.safeParse({ ...base, licenseUrl: link }).success).toBe(
        false,
      );
      expect(AdminMediaUpdateInputSchema.safeParse({ ...base, sourceUrl: link }).success).toBe(
        false,
      );
    },
  );

  it('http thường vẫn nhận (link nguồn cũ của Commons)', () => {
    expect(
      AdminMediaUpdateInputSchema.safeParse({ ...base, sourceUrl: 'http://example.com/a.jpg' })
        .success,
    ).toBe(true);
  });

  it('độ dài theo cột', () => {
    const long = (n: number) => `https://example.com/${'a'.repeat(n - 20)}`;
    expect(
      AdminMediaUpdateInputSchema.safeParse({ ...base, licenseUrl: long(MEDIA_LICENSE_URL_MAX) })
        .success,
    ).toBe(true);
    expect(
      AdminMediaUpdateInputSchema.safeParse({
        ...base,
        licenseUrl: long(MEDIA_LICENSE_URL_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      AdminMediaUpdateInputSchema.safeParse({ ...base, sourceUrl: long(MEDIA_SOURCE_URL_MAX + 1) })
        .success,
    ).toBe(false);
    expect(AdminMediaUpdateInputSchema.safeParse({ ...base, alt: 'a'.repeat(301) }).success).toBe(
      false,
    );
    expect(
      AdminMediaUpdateInputSchema.safeParse({ ...base, author: 'a'.repeat(201) }).success,
    ).toBe(false);
    expect(
      AdminMediaUpdateInputSchema.safeParse({ ...base, license: 'a'.repeat(61) }).success,
    ).toBe(false);
  });

  it('publicId lạ dạng bị từ chối', () => {
    expect(
      AdminMediaUpdateInputSchema.safeParse({ ...base, publicId: '../../etc/passwd' }).success,
    ).toBe(false);
  });
});
