import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { ContentHero } from '@/components/content/content-hero';
import { LoadErrorState } from '@/components/feedback/load-error-state';
import { ToursExplorer } from '@/components/tours/tours-explorer';
import { contentState, settle } from '@/lib/api/resilience';
import { fetchCategories, fetchDestinations, fetchTours } from '@/lib/api/tours';
import { listParam, type RawSearchParam, singleParam } from '@/lib/search-params';

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
  // `string[]` khi một khoá lặp lại trên URL — chuẩn hoá ngay dưới, trước khi
  // tới `ToursExplorer` (chỉ biết `string`).
  searchParams: Promise<Record<string, RawSearchParam>>;
}) {
  const params = await searchParams;

  // settle() không bao giờ throw — ba fetch chạy song song, mỗi cái tự đứng
  // độc lập, một cái sập không kéo cái kia theo (ADR-0016 §4, giống cụm Blog).
  const [toursRes, destinationsRes, categoriesRes] = await Promise.all([
    settle(fetchTours()),
    settle(fetchDestinations()),
    settle(fetchCategories()),
  ]);
  // Hai facet đều là điều hướng PHỤ — tours sống mà facet chết thì vẫn hiện
  // lưới tour, thẻ facet suy từ tour đã tải (`resolveCategoryOptions`,
  // `resolveDestinationOptions`); chỉ tours chết mới là lỗi trang.
  // `isEmpty` cố tình luôn false: 0 tour do lọc/tìm đã có màn "Nothing here yet"
  // riêng của ToursExplorer, page không cần một trạng thái rỗng thứ hai.
  const state = contentState({ failed: !toursRes.ok, isEmpty: false });

  // Truyền THÔ xuống ToursExplorer, KHÔNG lọc sạch giá trị lạ ở đây: slug lạ
  // (link cũ / gõ tay) phải cho trạng thái rỗng, không 404 và không âm thầm rơi
  // về "All". Đây đúng là bug đã sửa ở /blog — lọc sạch tag lạ thành undefined
  // làm URL vẫn ghi ?tag=… mà lưới hiện đủ bài với chip "All" sáng.
  const initial = {
    categories: listParam(params.categories),
    destinations: listParam(params.destinations),
    durations: listParam(params.durations),
    prices: listParam(params.prices),
    difficulties: listParam(params.difficulties),
    featured: singleParam(params.featured) === 'true',
    q: singleParam(params.q),
    sort: singleParam(params.sort),
    page: Number(singleParam(params.page)) || 1,
    limit: Number(singleParam(params.limit)) || undefined,
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
  // Bộ chip danh mục đọc THẲNG từ endpoint, đã lọc `is_active` và sắp theo
  // `order` ở server. Suy từ danh sách tour đã tải (cách cũ) làm hai nút của
  // back office không với tới trang này: ẩn một danh mục vẫn thấy chip, đổi
  // thứ tự vẫn không đổi gì.
  //
  // `null` khi lời gọi HỎNG, không phải `[]`: mảng rỗng là một câu trả lời
  // hợp lệ (mọi danh mục đều đã ẩn), còn lẫn hai ca ấy thì một lượt 500 của
  // `/api/categories` xoá sạch thẻ facet "Category" khỏi một trang vẫn đang
  // sống. `resolveCategoryOptions` rơi về suy-từ-tour ở ca hỏng.
  const categories = categoriesRes.ok ? categoriesRes.data : null;
  // Cùng luật cho điểm đến (Task 9a của F15): trước đây `data ?? []`, nên một
  // lượt 500 của `/api/destinations` xoá sạch thẻ Destination và in "across 0
  // destinations" lên hero. `resolveDestinationOptions` rơi về suy-từ-tour.
  const destinations = destinationsRes.ok ? destinationsRes.data : null;

  return (
    <ToursExplorer
      tours={tours}
      categories={categories}
      destinations={destinations}
      initial={initial}
    />
  );
}
