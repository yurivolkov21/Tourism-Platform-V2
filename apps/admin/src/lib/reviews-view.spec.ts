import type { AdminReview, MediaItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { reviewStateBadgeVariant, toReviewRow } from './reviews-view';

/**
 * Mapper hiển thị hàng đợi moderation (spec P4b §3-F4) — THUẦN, ngoài React:
 * bảng chỉ render VM có sẵn, không tự format ngày, không tự đoán phải gọi tác
 * giả là gì khi tài khoản đã bị xoá.
 */
const t = messages.admin.reviews.list;

const PHOTO: MediaItem = {
  publicId: 'reviews/BK-ABCD1234/one',
  url: 'https://res.cloudinary.com/demo/image/upload/one.jpg',
  type: 'IMAGE',
  role: 'gallery',
  posterUrl: null,
  width: 1600,
  height: 1200,
  alt: 'Sunrise over the bay',
  sortOrder: 0,
  author: null,
  license: null,
  licenseUrl: null,
  sourceUrl: null,
};

const PENDING: AdminReview = {
  id: '11111111-1111-4111-8111-111111111111',
  rating: 5,
  title: 'Trip of a lifetime',
  body: 'The guide knew every cove and the kayaking was the highlight.',
  authorName: 'Ada Lovelace',
  authorDeleted: false,
  createdAt: '2026-08-30T09:30:00.000Z',
  media: [],
  isApproved: false,
  source: 'VERIFIED',
  tourSlug: 'ha-long-bay-cruise',
  tourTitle: 'Ha Long Bay Cruise',
  moderatedAt: null,
  moderatedBy: null,
};

describe('toReviewRow', () => {
  it('review chờ duyệt → hàng đầy đủ, chưa có dấu vết moderation', () => {
    expect(toReviewRow(PENDING)).toEqual({
      id: PENDING.id,
      rating: 5,
      ratingLabel: t.ratingLabel(5),
      title: 'Trip of a lifetime',
      body: 'The guide knew every cove and the kayaking was the highlight.',
      photos: [],
      photosLabel: null,
      authorLabel: 'Ada Lovelace',
      authorDeleted: false,
      source: 'VERIFIED',
      sourceLabel: messages.admin.reviews.source.VERIFIED,
      tourTitle: 'Ha Long Bay Cruise',
      approved: false,
      stateLabel: messages.admin.reviews.state.pending,
      submitted: '30 Aug 2026, 09:30 UTC',
      moderated: null,
      moderatedBy: null,
    });
  });

  it('review đã duyệt → nhãn trạng thái + dấu vết ai duyệt lúc nào', () => {
    const row = toReviewRow({
      ...PENDING,
      isApproved: true,
      moderatedAt: '2026-08-31T14:05:00.000Z',
      moderatedBy: 'Grace Hopper',
    });
    expect(row.approved).toBe(true);
    expect(row.stateLabel).toBe(messages.admin.reviews.state.approved);
    expect(row.moderated).toBe(t.moderated('31 Aug 2026, 14:05 UTC'));
    expect(row.moderatedBy).toBe(t.moderatedBy('Grace Hopper'));
  });

  it('đã duyệt nhưng KHÔNG biết ai (moderatedBy null — admin cũ đã bị xoá) vẫn giữ mốc thời gian', () => {
    const row = toReviewRow({ ...PENDING, moderatedAt: '2026-08-31T14:05:00.000Z' });
    expect(row.moderated).toBe(t.moderated('31 Aug 2026, 14:05 UTC'));
    expect(row.moderatedBy).toBeNull();
  });

  it('tác giả đã xoá tài khoản → "Deleted account", review vẫn ở lại hàng đợi', () => {
    // `authorName` về null ở API khi `authorDeleted` (GDPR erasure, audit H5b)
    // — bảng KHÔNG được render ô trống nhìn như hỏng.
    const row = toReviewRow({ ...PENDING, authorName: null, authorDeleted: true });
    expect(row.authorLabel).toBe(t.deletedAuthor);
    expect(row.authorDeleted).toBe(true);
  });

  it('ảnh khách đính kèm → thumbnail có url + alt; alt null thành chuỗi rỗng', () => {
    const row = toReviewRow({ ...PENDING, media: [PHOTO, { ...PHOTO, alt: null }] });
    expect(row.photos).toEqual([
      { url: PHOTO.url, alt: 'Sunrise over the bay' },
      { url: PHOTO.url, alt: '' },
    ]);
    expect(row.photosLabel).toBe(t.photos(2));
  });

  it('một ảnh dùng số ít, không ảnh thì KHÔNG có nhãn nào', () => {
    expect(toReviewRow({ ...PENDING, media: [PHOTO] }).photosLabel).toBe(t.photos(1));
    expect(toReviewRow(PENDING).photosLabel).toBeNull();
  });

  it('review CURATED không gắn tour → tour null (bảng tự hiện câu "không gắn tour")', () => {
    const row = toReviewRow({
      ...PENDING,
      source: 'CURATED',
      tourTitle: null,
    });
    expect(row.tourTitle).toBeNull();
    expect(row.sourceLabel).toBe(messages.admin.reviews.source.CURATED);
  });

  it('review không có tiêu đề (title là optional ở contract) vẫn ra hàng hợp lệ', () => {
    expect(toReviewRow({ ...PENDING, title: null }).title).toBeNull();
  });
});

describe('reviewStateBadgeVariant', () => {
  it('đã duyệt nổi bật (đang hiện với công chúng), chờ duyệt nhạt — cùng giọng REQUESTED của cancellations', () => {
    expect(reviewStateBadgeVariant(true)).toBe('default');
    expect(reviewStateBadgeVariant(false)).toBe('secondary');
  });
});
