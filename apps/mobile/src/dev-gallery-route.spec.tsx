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

it('ở chế độ dev thì mở được gallery', async () => {
  isDevBuildMock.mockReturnValue(true);
  const app = renderRouter('src/app', { initialUrl: '/dev/gallery' });
  await app;

  expect(app.getPathname()).toBe('/dev/gallery');
});

it('bản phát hành thì không có đường vào gallery', async () => {
  isDevBuildMock.mockReturnValue(false);
  const app = renderRouter('src/app', { initialUrl: '/dev/gallery' });
  await app;

  expect(app.getPathname()).toBe('/');
});
