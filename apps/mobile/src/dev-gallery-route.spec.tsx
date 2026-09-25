import { renderRouter } from 'expo-router/testing-library';
import { onboardingStore } from '@/features/onboarding/onboarding-store';
import { isDevBuild } from '@/lib/dev-only';

// File riêng vì nó thay hẳn `@/lib/dev-only` cho cả sổ module — `routes.spec.tsx`
// cần bản thật.
jest.mock('@/lib/dev-only', () => ({ isDevBuild: jest.fn() }));

const isDevBuildMock = isDevBuild as jest.Mock;

beforeEach(async () => {
  await onboardingStore.markSeen();
});

it.each([['/dev/gallery'], ['/dev/tour-gallery']])('ở chế độ dev thì mở được %s', async (url) => {
  isDevBuildMock.mockReturnValue(true);
  const app = renderRouter('src/app', { initialUrl: url });
  await app;

  expect(app.getPathname()).toBe(url);
});

it.each([['/dev/gallery'], ['/dev/tour-gallery']])(
  'bản phát hành thì không có đường vào %s',
  async (url) => {
    isDevBuildMock.mockReturnValue(false);
    const app = renderRouter('src/app', { initialUrl: url });
    await app;

    expect(app.getPathname()).toBe('/');
  },
);
