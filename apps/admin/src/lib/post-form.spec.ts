import {
  AdminPostUpdateInputSchema,
  POST_CONTENT_MAX,
  POST_COVER_ALT_MAX,
  POST_EXCERPT_MAX,
  POST_TITLE_MAX,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { POST_ID, POST_VERSION, postDetailFixture, TOUR_A } from '@/test/post-detail';
import {
  coverFileProblem,
  fromUtcInputValue,
  libraryCoverDraft,
  nowUtcInputValue,
  postFormValues,
  postPayload,
  projectedPostReadiness,
  toUtcInputValue,
  uploadedCoverDraft,
  validatePostForm,
  withPendingTag,
  withStatus,
} from './post-form';

const fe = messages.admin.posts.editor.form.errors;
const UPLOAD = { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 };

describe('giờ UTC của ô datetime-local', () => {
  it('ISO → giá trị ô, đọc như giờ UTC; giây bị bỏ', () => {
    expect(toUtcInputValue('2026-10-05T09:30:45.123Z')).toBe('2026-10-05T09:30');
  });

  it('giá trị ô → ISO UTC; trống, sai dạng hay ngày không có thật là null', () => {
    expect(fromUtcInputValue('2026-10-05T09:30')).toBe('2026-10-05T09:30:00.000Z');
    expect(fromUtcInputValue('')).toBeNull();
    expect(fromUtcInputValue('2026-10-05 09:30')).toBeNull();
    expect(fromUtcInputValue('2026-02-31T10:00')).toBeNull();
  });

  it('"bây giờ" làm tròn xuống phút', () => {
    expect(nowUtcInputValue(new Date('2026-10-02T12:34:56.789Z'))).toBe('2026-10-02T12:34');
  });
});

describe('postFormValues / postPayload', () => {
  it('mở ra rồi lưu nguyên: payload hợp lệ với contract và nói đúng bài đang lưu', () => {
    const detail = postDetailFixture();
    const payload = postPayload(detail.id, detail.version, postFormValues(detail));
    expect(AdminPostUpdateInputSchema.parse(payload)).toEqual(payload);
    expect(payload).toEqual({
      id: POST_ID,
      version: POST_VERSION,
      title: 'Eating your way through Hội An',
      excerpt: 'Five stalls before noon.',
      content: '## Morning\n\nBánh mì first.',
      status: 'PUBLISHED',
      publishedAt: '2026-10-01T08:00:00.000Z',
      tags: ['Food'],
      relatedTourIds: [TOUR_A.id],
      cover: { publicId: `tourism/posts/${POST_ID}/cover`, alt: 'Lanterns over the river' },
    });
  });

  it('ô trống thành null; alt chỉ có khoảng trắng thành null; ảnh vừa tải mang metadata', () => {
    const values = {
      ...postFormValues(postDetailFixture()),
      excerpt: '   ',
      cover: {
        publicId: `tourism/posts/${POST_ID}/new`,
        url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1759000000/x',
        alt: '  ',
        source: 'UPLOAD' as const,
        upload: UPLOAD,
      },
    };
    const payload = postPayload(POST_ID, POST_VERSION, values);
    expect(payload.excerpt).toBeNull();
    expect(payload.cover).toEqual({
      publicId: `tourism/posts/${POST_ID}/new`,
      alt: null,
      upload: UPLOAD,
    });
  });

  it('nháp chưa từng đăng: ô ngày trống, tóm tắt null thành chuỗi rỗng, không ảnh bìa', () => {
    const values = postFormValues(
      postDetailFixture({ status: 'DRAFT', publishedAt: null, excerpt: null, cover: null }),
    );
    expect(values).toMatchObject({ status: 'DRAFT', publishAt: '', excerpt: '', cover: null });
  });
});

describe('validatePostForm', () => {
  const values = () => postFormValues(postDetailFixture());

  it('bài đủ thì không lỗi', () => {
    expect(validatePostForm(values())).toEqual({});
  });

  it('tiêu đề trống; các trần của contract', () => {
    expect(validatePostForm({ ...values(), title: '  ' }).title).toBe(fe.required);
    expect(validatePostForm({ ...values(), title: 'x'.repeat(POST_TITLE_MAX + 1) }).title).toBe(
      fe.tooLong(POST_TITLE_MAX),
    );
    expect(
      validatePostForm({ ...values(), excerpt: 'x'.repeat(POST_EXCERPT_MAX + 1) }).excerpt,
    ).toBe(fe.tooLong(POST_EXCERPT_MAX));
    expect(
      validatePostForm({ ...values(), content: 'x'.repeat(POST_CONTENT_MAX + 1) }).content,
    ).toBe(fe.tooLong(POST_CONTENT_MAX));
  });

  it('thân bài có ảnh nhúng hay HTML: câu riêng từng loại', () => {
    expect(validatePostForm({ ...values(), content: 'a ![b](https://x.io/y.jpg)' }).content).toBe(
      fe.image,
    );
    expect(validatePostForm({ ...values(), content: 'a <b>c</b>' }).content).toBe(fe.html);
  });

  it('Published phải có ngày giờ hợp lệ; Draft thì không cần', () => {
    expect(validatePostForm({ ...values(), publishAt: '' }).publishAt).toBe(fe.publishDate);
    expect(validatePostForm({ ...values(), status: 'DRAFT', publishAt: '' })).toEqual({});
  });

  it('alt ảnh bìa vượt trần', () => {
    const v = values();
    const cover = v.cover && { ...v.cover, alt: 'x'.repeat(POST_COVER_ALT_MAX + 1) };
    expect(validatePostForm({ ...v, cover }).coverAlt).toBe(fe.tooLong(POST_COVER_ALT_MAX));
  });
});

describe('projectedPostReadiness', () => {
  it('đọc bản ĐANG SOẠN, không phải bản đã lưu', () => {
    const detail = postDetailFixture();
    expect(detail.readiness).toEqual([]);
    expect(
      projectedPostReadiness({ ...postFormValues(detail), content: ' ', cover: null }),
    ).toEqual(['content', 'cover']);
  });
});

describe('withStatus', () => {
  const NOW = new Date('2026-10-02T12:34:56.000Z');

  it('sang Published mà ô ngày trống: tự điền "bây giờ" (spec §2.2)', () => {
    const draft = postFormValues(postDetailFixture({ status: 'DRAFT', publishedAt: null }));
    expect(withStatus(draft, 'PUBLISHED', NOW, draft.publishAt)).toMatchObject({
      status: 'PUBLISHED',
      publishAt: '2026-10-02T12:34',
    });
  });

  it('đã có ngày thì giữ; về Draft cũng giữ — bài về nháp không mất ngày cũ', () => {
    const published = postFormValues(postDetailFixture());
    const saved = published.publishAt;
    expect(withStatus(published, 'PUBLISHED', NOW, saved).publishAt).toBe('2026-10-01T08:00');
    expect(withStatus(published, 'DRAFT', NOW, saved)).toMatchObject({
      status: 'DRAFT',
      publishAt: '2026-10-01T08:00',
    });
  });

  // Vòng review P4e-4: ngày tự điền từng lọt vào nháp rồi bị dùng lại ở lần đăng sau — bài lên
  // web với ngày cũ, tụt xuống dưới danh sách.
  it('bài chưa từng có ngày: tự điền rồi về Draft thì ô ngày trống lại', () => {
    const draft = postFormValues(postDetailFixture({ status: 'DRAFT', publishedAt: null }));
    const toggled = withStatus(draft, 'PUBLISHED', NOW, draft.publishAt);
    expect(withStatus(toggled, 'DRAFT', NOW, draft.publishAt)).toMatchObject({
      status: 'DRAFT',
      publishAt: '',
    });
  });
});

describe('ảnh bìa', () => {
  it('file nhận được: đuôi ảnh cho phép, tối đa 10 MB — cùng luật tab Photos của tour', () => {
    expect(coverFileProblem({ name: 'lanterns.JPG', size: 10 * 1024 * 1024 })).toBeNull();
    expect(coverFileProblem({ name: 'notes.pdf', size: 10 })).toBe('type');
    expect(coverFileProblem({ name: 'huge.jpg', size: 10 * 1024 * 1024 + 1 })).toBe('size');
  });

  it('ảnh vừa tải: URL có phiên bản, alt trống, mang metadata để lưu', () => {
    expect(
      uploadedCoverDraft({ publicId: `tourism/posts/${POST_ID}/pid-1`, upload: UPLOAD }, 'demo'),
    ).toEqual({
      publicId: `tourism/posts/${POST_ID}/pid-1`,
      url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1759000000/tourism/posts/${POST_ID}/pid-1`,
      alt: '',
      source: 'UPLOAD',
      upload: UPLOAD,
    });
  });

  it('ảnh thư viện: alt chép từ ảnh gốc (null thành chuỗi rỗng), không metadata', () => {
    const photo = {
      publicId: 'lib/a1',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/a1',
      alt: null,
      width: 2400,
      height: 1600,
      author: null,
      license: null,
    };
    expect(libraryCoverDraft(photo)).toEqual({
      publicId: 'lib/a1',
      url: photo.url,
      alt: '',
      source: 'LIBRARY',
    });
  });
});

// Vòng review P4e-4: chữ còn trong ô Tags mà chưa bấm Add bị bỏ im lặng khi lưu.
describe('withPendingTag', () => {
  const base = () => postFormValues(postDetailFixture());

  it('ô Tags trống (hay chỉ có khoảng trắng): giữ nguyên giá trị', () => {
    const values = { ...base(), tagDraft: '   ' };
    expect(withPendingTag(values)).toEqual({ ok: true, values });
  });

  it('chữ còn trong ô: thêm thành tag, ô trống lại', () => {
    expect(withPendingTag({ ...base(), tagDraft: ' Street food ' })).toEqual({
      ok: true,
      values: { ...base(), tags: ['Food', 'Street food'], tagDraft: '' },
    });
  });

  it('không thêm được (trùng theo slug): báo lý do, không đổi gì', () => {
    expect(withPendingTag({ ...base(), tagDraft: 'food' })).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });
});
