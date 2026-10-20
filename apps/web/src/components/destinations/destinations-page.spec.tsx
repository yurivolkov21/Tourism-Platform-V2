import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { MotionConfig } from 'motion/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import DestinationsPage from '@/app/(site)/destinations/page';
import { fetchDestinations, fetchTours } from '@/lib/api/tours';
import { FIXTURE_DESTINATIONS, FIXTURE_TOURS } from '@/test/fixtures/catalog';

// Trang là Server Component async: gọi thẳng hàm để lấy cây JSX rồi render như
// component thường. API giả lập ở tầng `fetch*` — `settle()` của trang tự bắt lỗi.
vi.mock('@/lib/api/tours', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/tours')>()),
  fetchTours: vi.fn(),
  fetchDestinations: vi.fn(),
}));
vi.mock('@/lib/api/site-media', () => ({ fetchSiteMedia: vi.fn(async () => new Map()) }));
// `LoadErrorState` (khu vùng khi API lỗi) gọi `useRouter` — ngoài app router thì nó ném.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

beforeAll(() => {
  // Khu Moments/Quotes dùng `whileInView`; jsdom không có IntersectionObserver.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

async function renderPage() {
  const page = await DestinationsPage();
  return render(<MotionConfig reducedMotion="always">{page}</MotionConfig>);
}

describe('/destinations — câu dẫn ở hero', () => {
  it('đếm số địa điểm khi API trả danh sách', async () => {
    vi.mocked(fetchTours).mockResolvedValueOnce(FIXTURE_TOURS);
    vi.mocked(fetchDestinations).mockResolvedValueOnce(FIXTURE_DESTINATIONS);
    await renderPage();
    expect(
      screen.getByText(messages.destinationsPage.heroSubtitle(FIXTURE_DESTINATIONS.length)),
    ).toBeInTheDocument();
  });

  it('API địa điểm lỗi thì KHÔNG in "0 places" — đó là một con số sai, không phải dữ liệu', async () => {
    vi.mocked(fetchTours).mockResolvedValueOnce(FIXTURE_TOURS);
    vi.mocked(fetchDestinations).mockRejectedValueOnce(new Error('API down'));
    await renderPage();
    expect(screen.queryByText(/0 places/)).toBeNull();
    expect(screen.getByText(messages.destinationsPage.heroSubtitleMeta)).toBeInTheDocument();
  });
});
