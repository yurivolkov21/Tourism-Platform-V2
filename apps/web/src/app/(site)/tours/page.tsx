import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { ToursExplorer } from '@/components/tours/tours-explorer';
import { tourCategories } from '@/lib/tours';
import { DESTINATIONS } from '@/mocks/destinations';
import { TOURS } from '@/mocks/tours';

export const metadata: Metadata = {
  title: 'Tours — Tourism',
  description: messages.toursPage.subtitle,
  // Canonical: mẫu /blog bỏ sót cái này so với Nexora. Trang listing có
  // ?categories=&destinations=&page= nên càng cần trỏ về bản không tham số.
  alternates: { canonical: '/tours' },
};

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<{
    categories?: string;
    destinations?: string;
    durations?: string;
    prices?: string;
    difficulties?: string;
    featured?: string;
    q?: string;
    sort?: string;
    page?: string;
    limit?: string;
  }>;
}) {
  const params = await searchParams;

  // Truyền THÔ xuống ToursExplorer, KHÔNG lọc sạch giá trị lạ ở đây: slug lạ
  // (link cũ / gõ tay) phải cho trạng thái rỗng, không 404 và không âm thầm rơi
  // về "All". Đây đúng là bug đã sửa ở /blog — lọc sạch tag lạ thành undefined
  // làm URL vẫn ghi ?tag=… mà lưới hiện đủ bài với chip "All" sáng.
  const initial = {
    categories: params.categories,
    destinations: params.destinations,
    durations: params.durations,
    prices: params.prices,
    difficulties: params.difficulties,
    featured: params.featured === 'true',
    q: params.q,
    sort: params.sort,
    page: Number(params.page) || 1,
    limit: Number(params.limit) || undefined,
  };

  return (
    <ToursExplorer
      tours={TOURS}
      categories={tourCategories(TOURS)}
      destinations={DESTINATIONS}
      initial={initial}
    />
  );
}
