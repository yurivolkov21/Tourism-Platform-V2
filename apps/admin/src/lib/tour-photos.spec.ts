import { contract, TOUR_PHOTOS_MAX } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { COVER_PHOTO, detailFixture } from '@/test/tour-detail';
import {
  acceptFiles,
  hasPhotoErrors,
  libraryPhotoDraft,
  makeCover,
  PHOTOS_CONTRACT_CODES,
  type PhotoDraft,
  photoSourceLine,
  photosFormValues,
  photosPayload,
  remainingCapacity,
  runWithConcurrency,
  SIGN_UPLOADS_CONTRACT_CODES,
  skippedCopy,
  uploadedPhotoDraft,
  validatePhotosForm,
} from './tour-photos';

const t = messages.admin.tours.editor.photos;
const fe = messages.admin.tours.editor.form.errors;

const draft = (key: string, over: Partial<PhotoDraft> = {}): PhotoDraft => ({
  key,
  publicId: `lib/${key}`,
  url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/${key}`,
  alt: `Photo ${key}`,
  source: 'LIBRARY',
  author: null,
  license: null,
  ...over,
});

describe('tập mã lỗi khớp contract (khuôn tour-editor-write.spec)', () => {
  it('hai codec của tab Photos phủ ĐÚNG các mã mà contract khai', () => {
    const codes = (errorMap: object) => Object.keys(errorMap).sort();
    const tours = contract.admin.tours;
    expect([...PHOTOS_CONTRACT_CODES].sort()).toEqual(codes(tours.setPhotos['~orpc'].errorMap));
    expect([...SIGN_UPLOADS_CONTRACT_CODES].sort()).toEqual(
      codes(tours.signPhotoUploads['~orpc'].errorMap),
    );
  });
});

describe('photosFormValues', () => {
  it('key tất định theo vị trí (bài học 12); alt null thành chuỗi rỗng', () => {
    const detail = detailFixture({
      photos: [COVER_PHOTO, { ...COVER_PHOTO, publicId: 'x', alt: null }],
    });
    const values = photosFormValues(detail);
    expect(values.photos.map((p) => p.key)).toEqual(['photo-0', 'photo-1']);
    expect(values.photos[1]?.alt).toBe('');
  });
});

describe('validatePhotosForm', () => {
  it('alt bắt buộc sau khi bỏ khoảng trắng, tối đa 300 ký tự; lỗi khoá theo key của dòng', () => {
    const detail = detailFixture();
    const errors = validatePhotosForm(
      {
        photos: [
          draft('a', { alt: '   ' }),
          draft('b', { alt: 'x'.repeat(301) }),
          draft('c', { alt: 'x'.repeat(300) }),
        ],
      },
      detail,
    );
    expect(errors.rows).toEqual({ a: t.altRequired, b: fe.tooLong(300) });
    expect(hasPhotoErrors(errors)).toBe(true);
  });

  it('quá 30 ảnh → lỗi của cả danh sách nói bớt mấy ảnh; đúng 30 thì sạch (vòng review F18)', () => {
    const photos = (n: number) => Array.from({ length: n }, (_, i) => draft(`p${i}`));
    const detail = detailFixture({ isPublished: false });
    expect(validatePhotosForm({ photos: photos(TOUR_PHOTOS_MAX) }, detail).list).toBeUndefined();
    expect(validatePhotosForm({ photos: photos(TOUR_PHOTOS_MAX + 1) }, detail).list).toBe(
      fe.tooManyPhotos(TOUR_PHOTOS_MAX, 1),
    );
    expect(validatePhotosForm({ photos: photos(TOUR_PHOTOS_MAX + 3) }, detail).list).toBe(
      fe.tooManyPhotos(TOUR_PHOTOS_MAX, 3),
    );
  });

  it('một ảnh có mặt hai lần → lỗi ở dòng SAU, dòng đầu giữ nguyên (vòng review F18)', () => {
    const errors = validatePhotosForm(
      { photos: [draft('a'), draft('b'), draft('c', { publicId: 'lib/a' })] },
      detailFixture(),
    );
    expect(errors.rows).toEqual({ c: t.duplicate });
  });

  it('tour đang bán gỡ hết ảnh → lỗi của cả danh sách; tắt bán thì không', () => {
    expect(validatePhotosForm({ photos: [] }, detailFixture()).list).toBe(fe.photosOnSale);
    expect(
      validatePhotosForm({ photos: [] }, detailFixture({ isPublished: false })).list,
    ).toBeUndefined();
    expect(
      hasPhotoErrors(validatePhotosForm({ photos: [] }, detailFixture({ isPublished: false }))),
    ).toBe(false);
  });
});

describe('photosPayload', () => {
  it('theo thứ tự danh sách, alt đã bỏ khoảng trắng, upload chỉ đi kèm ảnh vừa tải', () => {
    const upload = { version: '1', width: 1, height: 1, format: 'jpg', bytes: 1 };
    expect(
      photosPayload('id-1', 'v-1', {
        photos: [draft('b', { alt: ' B ', upload, source: 'UPLOAD' }), draft('a')],
      }),
    ).toEqual({
      id: 'id-1',
      version: 'v-1',
      photos: [
        { publicId: 'lib/b', alt: 'B', upload },
        { publicId: 'lib/a', alt: 'Photo a' },
      ],
    });
  });
});

describe('makeCover', () => {
  it('đưa ảnh lên đầu; ảnh bìa cũ lùi xuống vị trí hai, còn lại giữ thứ tự', () => {
    const values = { photos: [draft('a'), draft('b'), draft('c')] };
    expect(makeCover(values, 'c').photos.map((p) => p.key)).toEqual(['c', 'a', 'b']);
    expect(makeCover(values, 'zzz')).toBe(values);
  });
});

describe('remainingCapacity / acceptFiles', () => {
  const file = (name: string, bytes: number) => new File([new Uint8Array(bytes)], name);

  it('sức chứa = 30 trừ ảnh đang có trừ file đang tải; không âm', () => {
    expect(remainingCapacity(10, 2)).toBe(TOUR_PHOTOS_MAX - 12);
    expect(remainingCapacity(30, 1)).toBe(0);
  });

  it('loại file sai đuôi, quá 10 MB, và phần dư quá sức chứa — kèm lý do', () => {
    const { accepted, skipped } = acceptFiles(
      [
        file('a.jpg', 10),
        file('b.pdf', 10),
        file('c.png', 10 * 1024 * 1024 + 1),
        file('d.webp', 10 * 1024 * 1024),
        file('e.gif', 10),
      ],
      2,
    );
    expect(accepted.map((f) => f.name)).toEqual(['a.jpg', 'd.webp']);
    expect(skipped).toEqual([
      { name: 'b.pdf', reason: 'type' },
      { name: 'c.png', reason: 'size' },
      { name: 'e.gif', reason: 'full' },
    ]);
    expect(skipped.map(skippedCopy)).toEqual([
      t.skipped.type('b.pdf'),
      t.skipped.size('c.png'),
      t.skipped.full('e.gif'),
    ]);
  });
});

describe('uploadedPhotoDraft / libraryPhotoDraft / photoSourceLine', () => {
  it('ảnh vừa tải: nguồn UPLOAD, alt rỗng để admin điền, URL dựng từ cloudName và version', () => {
    const photo = uploadedPhotoDraft(
      {
        publicId: 'tourism/tours/t-1/pid',
        upload: { version: '17', width: 2, height: 1, format: 'jpg', bytes: 3 },
      },
      'demo',
    );
    expect(photo).toMatchObject({
      publicId: 'tourism/tours/t-1/pid',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v17/tourism/tours/t-1/pid',
      alt: '',
      source: 'UPLOAD',
      author: null,
    });
    expect(photoSourceLine(photo)).toBe(t.uploaded);
  });

  it('ảnh thư viện: alt chép từ ảnh gốc, ghi công in khi có', () => {
    const photo = libraryPhotoDraft({
      publicId: 'lib/1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/1',
      alt: 'Lanterns',
      width: 1,
      height: 1,
      author: 'J. Nguyen',
      license: 'CC BY-SA 4.0',
    });
    expect(photo).toMatchObject({ alt: 'Lanterns', source: 'LIBRARY' });
    expect(photoSourceLine(photo)).toBe(
      `${t.fromLibrary} · ${t.credit('J. Nguyen', 'CC BY-SA 4.0')}`,
    );
    expect(photoSourceLine({ ...photo, author: null })).toBe(t.fromLibrary);
  });
});

describe('photoSourceLine — ảnh bìa gốc (ADR-0048 AMEND 1)', () => {
  it('CATALOG: nói rõ là ảnh catalog và gỡ ra không thêm lại được; ghi công in khi có', () => {
    expect(
      photoSourceLine(draft('c', { source: 'CATALOG', author: 'Unsplash+', license: null })),
    ).toBe(`${t.catalogue} · ${t.credit('Unsplash+', null)} · ${t.catalogueWarning}`);
    expect(photoSourceLine(draft('d', { source: 'CATALOG' }))).toBe(
      `${t.catalogue} · ${t.catalogueWarning}`,
    );
  });
});

describe('runWithConcurrency', () => {
  it('chạy hết mọi việc, không bao giờ quá `limit` việc cùng lúc', async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    const tasks = Array.from({ length: 7 }, (_, i) => async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      done.push(i);
    });
    await runWithConcurrency(tasks, 3);
    expect(done.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(peak).toBe(3);
  });

  it('signal huỷ thì thôi khởi động việc mới — rời tab không tải tiếp hàng đợi (vòng review F18)', async () => {
    const controller = new AbortController();
    const started: number[] = [];
    const tasks = Array.from({ length: 5 }, (_, i) => async () => {
      started.push(i);
      if (i === 1) controller.abort();
    });
    await runWithConcurrency(tasks, 1, controller.signal);
    expect(started).toEqual([0, 1]);
  });
});
