import { describe, expect, it } from 'vitest';
import { MediaType } from '../generated/prisma/enums.js';
import { buildCloudinaryUrl } from './cloudinary-url.js';

const CLOUD = 'demo-cloud';

describe('buildCloudinaryUrl', () => {
  it('dựng URL ảnh với transform f_auto,q_auto', () => {
    const r = buildCloudinaryUrl(CLOUD, { type: MediaType.IMAGE, publicId: 'posts/hero-a' });
    expect(r.url).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/posts/hero-a',
    );
    expect(r.posterUrl).toBeNull();
  });

  // ── Phiên bản trong URL ──
  // Thay ảnh mà giữ nguyên publicId thì URL không đổi, nên BỐN tầng cache đều
  // phát bản cũ: CDN Cloudinary, `.next/cache/images`, bản build, và nặng nhất
  // là cache trình duyệt của người dùng (`max-age=2592000` — 30 NGÀY). Chèn
  // phiên bản vào URL làm mỗi lần thay ảnh sinh một URL khác, nên cả bốn tầng
  // tự hết hiệu lực mà không phải xoá tay chỗ nào.
  it('có version → chèn /v<version>/ trước publicId', () => {
    const r = buildCloudinaryUrl(CLOUD, {
      type: MediaType.IMAGE,
      publicId: 'posts/hero-a',
      version: '1723600000',
    });
    expect(r.url).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/v1723600000/posts/hero-a',
    );
  });

  it('không version → URL giữ nguyên như cũ (ảnh cũ chưa có cột này)', () => {
    const r = buildCloudinaryUrl(CLOUD, { type: MediaType.IMAGE, publicId: 'posts/hero-a' });
    expect(r.url).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/posts/hero-a',
    );
  });

  it('video có version → cả URL video LẪN poster suy ra đều mang version', () => {
    const r = buildCloudinaryUrl(CLOUD, {
      type: MediaType.VIDEO,
      publicId: 'posts/clip',
      version: '1723600000',
    });
    expect(r.url).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/f_auto,q_auto,w_1600,c_limit/v1723600000/posts/clip',
    );
    expect(r.posterUrl).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/so_0,f_auto,q_auto,w_1600,c_limit/v1723600000/posts/clip.jpg',
    );
  });

  it('publicId tuyệt đối + version → vẫn trả nguyên, version bị BỎ QUA', () => {
    const abs = 'https://images.unsplash.com/photo-123';
    const r = buildCloudinaryUrl(CLOUD, {
      type: MediaType.IMAGE,
      publicId: abs,
      version: '1723600000',
    });
    expect(r.url).toBe(abs);
  });

  it('escape-hatch: publicId là URL tuyệt đối → trả nguyên, KHÔNG bọc transform', () => {
    const abs = 'https://images.unsplash.com/photo-123';
    const r = buildCloudinaryUrl(CLOUD, { type: MediaType.IMAGE, publicId: abs });
    expect(r.url).toBe(abs);
  });

  // URL video mang thêm `w_1600,c_limit` từ 17/08: video đi thẳng thẻ `<video>`
  // nên không có ai xin đúng cỡ hộ như `next/image` làm với ảnh. Nguồn 4K phục
  // vụ cho dải rộng 1280 là bắt khách tải gấp ~9 lần số điểm ảnh họ thấy — đo
  // trên clip CTA thật: 91MB xuống 4,4MB. `c_limit` chỉ thu nhỏ, không phóng to.
  it('video → URL video + posterUrl từ posterId', () => {
    const r = buildCloudinaryUrl(CLOUD, {
      type: MediaType.VIDEO,
      publicId: 'posts/clip',
      posterId: 'posts/clip-poster',
    });
    expect(r.url).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/f_auto,q_auto,w_1600,c_limit/posts/clip',
    );
    expect(r.posterUrl).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/posts/clip-poster',
    );
  });

  it('video không posterId → poster là frame đầu (so_0) của chính video', () => {
    const r = buildCloudinaryUrl(CLOUD, { type: MediaType.VIDEO, publicId: 'posts/clip' });
    expect(r.posterUrl).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/so_0,f_auto,q_auto,w_1600,c_limit/posts/clip.jpg',
    );
  });
});
