import { AUTH_PHOTOS } from './auth-media';

describe('AUTH_PHOTOS', () => {
  const all = [
    AUTH_PHOTOS.signIn,
    AUTH_PHOTOS.register,
    AUTH_PHOTOS.result,
    ...AUTH_PHOTOS.onboarding,
  ];

  it('mọi ảnh đều là URL https của kho media đang dùng', () => {
    for (const photo of all) {
      expect(photo.uri).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    }
  });

  it('onboarding đúng ba ảnh, không trùng nhau', () => {
    const uris = AUTH_PHOTOS.onboarding.map((photo) => photo.uri);

    expect(uris).toHaveLength(3);
    expect(new Set(uris).size).toBe(3);
  });
});
