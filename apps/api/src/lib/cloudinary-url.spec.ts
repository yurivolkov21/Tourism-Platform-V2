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

  it('escape-hatch: publicId là URL tuyệt đối → trả nguyên, KHÔNG bọc transform', () => {
    const abs = 'https://images.unsplash.com/photo-123';
    const r = buildCloudinaryUrl(CLOUD, { type: MediaType.IMAGE, publicId: abs });
    expect(r.url).toBe(abs);
  });

  it('video → URL video + posterUrl từ posterId', () => {
    const r = buildCloudinaryUrl(CLOUD, {
      type: MediaType.VIDEO,
      publicId: 'posts/clip',
      posterId: 'posts/clip-poster',
    });
    expect(r.url).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/f_auto,q_auto/posts/clip',
    );
    expect(r.posterUrl).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/posts/clip-poster',
    );
  });

  it('video không posterId → poster là frame đầu (so_0) của chính video', () => {
    const r = buildCloudinaryUrl(CLOUD, { type: MediaType.VIDEO, publicId: 'posts/clip' });
    expect(r.posterUrl).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/so_0,f_auto,q_auto/posts/clip.jpg',
    );
  });
});
