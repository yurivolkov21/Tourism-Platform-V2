import { MediaItemSchema, SignUploadInputSchema } from './media.js';

const validItem = {
  publicId: 'tourism/seed/destinations/ha-long/commons-ha-long-01',
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/x',
  type: 'IMAGE',
  role: 'gallery',
  posterUrl: null,
  width: 2669,
  height: 1948,
  alt: 'Limestone karsts rising out of Hạ Long Bay',
  sortOrder: 0,
  author: 'Vincent Guth',
  license: 'CC0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:H%E1%BA%A1_Long_Bay.jpg',
};

describe('MediaItemSchema — ghi công (ADR-0020)', () => {
  it('nhận đủ bốn trường ghi công', () => {
    const parsed = MediaItemSchema.parse(validItem);
    expect(parsed.author).toBe('Vincent Guth');
    expect(parsed.license).toBe('CC0');
  });

  it('cho phép cả bốn là null — ảnh Pixabay và ảnh tự chụp không cần ghi công', () => {
    const parsed = MediaItemSchema.parse({
      ...validItem,
      author: null,
      license: null,
      licenseUrl: null,
      sourceUrl: null,
    });
    expect(parsed.author).toBeNull();
  });

  it('BẮT BUỘC có mặt bốn khoá, dù giá trị null', () => {
    // Vì sao không `.optional()`: web phải biết chắc "chưa ai điền" (null) khác
    // với "trường này không tồn tại". Nếu optional, một asset CC BY thiếu ghi
    // công sẽ trượt qua im lặng và ta phát hành ảnh mà không thoả giấy phép.
    const { author: _a, ...thieuAuthor } = validItem;
    expect(() => MediaItemSchema.parse(thieuAuthor)).toThrow();
  });

  it('licenseUrl và sourceUrl phải là URL thật, không phải chuỗi bất kỳ', () => {
    expect(() => MediaItemSchema.parse({ ...validItem, licenseUrl: 'CC0' })).toThrow();
    expect(() => MediaItemSchema.parse({ ...validItem, sourceUrl: 'commons' })).toThrow();
  });

  it('license giữ nguyên chuỗi nguồn công bố, không tự chuẩn hoá', () => {
    // Commons trả về đủ kiểu: 'CC BY-SA 4.0', 'CC BY 2.0', 'Public domain'.
    // Ép về enum sẽ mất thông tin phiên bản, mà phiên bản quyết định nghĩa vụ.
    for (const lic of ['CC BY-SA 4.0', 'CC BY 2.0', 'Public domain', 'CC0']) {
      expect(MediaItemSchema.parse({ ...validItem, license: lic }).license).toBe(lic);
    }
  });
});

describe('SignUploadInputSchema', () => {
  it('AVATAR: chỉ cần purpose + ext hợp lệ', () => {
    expect(SignUploadInputSchema.parse({ purpose: 'AVATAR', ext: 'png' })).toEqual({
      purpose: 'AVATAR',
      ext: 'png',
    });
  });

  it('REVIEW_PHOTO: bắt buộc bookingCode đúng khuôn BK-XXXXXXXX', () => {
    expect(() => SignUploadInputSchema.parse({ purpose: 'REVIEW_PHOTO', ext: 'jpg' })).toThrow();
    const parsed = SignUploadInputSchema.parse({
      purpose: 'REVIEW_PHOTO',
      ext: 'jpg',
      bookingCode: 'BK-ABCD1234',
    });
    // Thu hẹp union bằng discriminant `purpose` — `.parse()` nhận `unknown`
    // nên TS không tự suy ra nhánh từ input, phải check runtime để truy cập
    // `bookingCode` (chỉ có ở nhánh REVIEW_PHOTO) mà không đỏ typecheck.
    if (parsed.purpose !== 'REVIEW_PHOTO') throw new Error('expected REVIEW_PHOTO branch');
    expect(parsed.bookingCode).toBe('BK-ABCD1234');
  });

  it('đuôi file ngoài whitelist ảnh → loại ngay tầng schema', () => {
    expect(() => SignUploadInputSchema.parse({ purpose: 'AVATAR', ext: 'exe' })).toThrow();
    expect(() => SignUploadInputSchema.parse({ purpose: 'AVATAR', ext: 'mp4' })).toThrow();
  });
});
