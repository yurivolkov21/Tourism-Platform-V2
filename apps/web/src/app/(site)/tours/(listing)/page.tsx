import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { ContentHero } from '@/components/content/content-hero';
import { LoadErrorState } from '@/components/feedback/load-error-state';
import { ToursExplorer } from '@/components/tours/tours-explorer';
import { contentState, settle } from '@/lib/api/resilience';
import { fetchDestinations, fetchTours } from '@/lib/api/tours';
import { tourCategories } from '@/lib/tours';

export const revalidate = 300; // ADR-0016 §3 — khớp REVALIDATE_SEC của fetchTours/fetchDestinations

export const metadata: Metadata = {
  title: 'Tours — Nexora',
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

  // settle() không bao giờ throw — hai fetch chạy song song, mỗi cái tự đứng
  // độc lập, một cái sập không kéo cái kia theo (ADR-0016 §4, giống cụm Blog).
  const [toursRes, destinationsRes] = await Promise.all([
    settle(fetchTours()),
    settle(fetchDestinations()),
  ]);
  // Facet destination là điều hướng PHỤ — tours sống mà facet chết thì vẫn hiện
  // lưới tour, sidebar destination rơi về rỗng; chỉ tours chết mới là lỗi trang.
  // `isEmpty` cố tình luôn false: 0 tour do lọc/tìm đã có màn "Nothing here yet"
  // riêng của ToursExplorer, page không cần một trạng thái rỗng thứ hai.
  const state = contentState({ failed: !toursRes.ok, isEmpty: false });

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

  if (state === 'error') {
    // ToursHero (hero thật của trang) sống BÊN TRONG ToursExplorer vì eyebrow
    // của nó cần đếm tours/destinations thật — không có dữ liệu thì không dựng
    // được. ContentHero là hero CHUNG, không cần số liệu, nên đứng thế chỗ ở
    // đúng nhánh lỗi này — tri-state, CẤM empty-state khi lỗi (ADR-0016 §4).
    return (
      <>
        <ContentHero
          breadcrumb={messages.toursPage.breadcrumb}
          title={messages.toursPage.title}
          subtitle={messages.toursPage.subtitle}
        />
        <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
          <div className="mx-auto max-w-7xl">
            <LoadErrorState />
          </div>
        </div>
      </>
    );
  }

  const tours = toursRes.data ?? [];
  const destinations = destinationsRes.data ?? [];

  return (
    <ToursExplorer
      tours={tours}
      categories={tourCategories(tours)}
      destinations={destinations}
      initial={initial}
    />
  );
}
