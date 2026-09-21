import { Injectable } from '@nestjs/common';
import type {
  AdminTourRow,
  AdminTourSetPublishedInput,
  AdminTourSetPublishedResult,
  AdminToursListQuery,
  Paged,
} from '@tourism/contract';
import { isWithinDeadline } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DepartureStatus, MediaOwnerType, MediaRole } from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';
import { MediaService } from '../media/media.service.js';
import { tourRevalidationTags } from '../web-revalidation/revalidation-decision.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import { pickCover } from './catalog.service.js';
import { departureWindow } from './departure-window.js';

/** Tour không tồn tại — controller dịch thành `NOT_FOUND` của contract. */
export class TourNotFoundError extends Error {}

/**
 * Prisma Decimal → chuỗi 2 chữ số thập phân ("39.00", KHÔNG "39"). Cùng luật
 * với `catalog.service.ts`: tiền KHÔNG BAO GIỜ thành float.
 */
const money = (value: Prisma.Decimal): string => value.toFixed(2);

/**
 * Bề mặt catalog phía ADMIN (spec P4e-1) — tách khỏi `CatalogService` vì hai
 * bề mặt trả lời hai câu hỏi khác nhau và có hai luật hiển thị khác nhau:
 * `CatalogService` chỉ được thấy row đã published và nấu nội dung bán hàng,
 * còn ở đây thấy TẤT CẢ và nấu con số vận hành.
 *
 * F11 (file này) là danh sách tour + công tắc đăng. F12 đắp thêm bề mặt chuyến
 * khởi hành vào chính service này.
 */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly media: MediaService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  /**
   * Một trang tour cho bảng vận hành, kèm số chuyến còn mở trong khoảng lọc.
   *
   * `month` KHÔNG vào `where` của tour — nó chỉ đổi cửa sổ đếm (xem
   * `AdminToursListQuerySchema`): tour không chạy tháng đó vẫn phải có mặt với
   * số 0, vì "tour này tháng sau không chạy" là một câu trả lời, không phải
   * một hàng đáng biến mất.
   */
  async listTours(query: AdminToursListQuery): Promise<Paged<AdminTourRow>> {
    const { page, limit, categoryId, isPublished, month } = query;
    // MỘT mốc cho cả lượt đọc — cửa sổ đếm nhìn đúng một khoảnh khắc.
    const now = new Date();

    const where: Prisma.TourWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      // `=== undefined` chứ không truthy: `false` là một GIÁ TRỊ (chỉ tour
      // đang ẩn), không phải cách nói "không lọc".
      ...(isPublished === undefined ? {} : { isPublished }),
    };

    const [total, tours] = await Promise.all([
      prisma.tour.count({ where }),
      prisma.tour.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          basePrice: true,
          currency: true,
          isPublished: true,
          isFeatured: true,
          category: { select: { name: true } },
        },
        // Sort phụ theo id giữ pagination ổn định khi title trùng nhau.
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const ids = tours.map((tour) => tour.id);
    const [coverMap, openCounts] = await Promise.all([
      // MỘT query media cho cả trang (chống N+1) — lọc hero ngay ở query, bảng
      // chỉ vẽ một ô ảnh nhỏ nên không cần cả bộ.
      this.media.resolveForOwners(MediaOwnerType.TOUR, ids, [MediaRole.hero]),
      // MỘT câu cho cả trang, KHÔNG phải một câu mỗi tour: 29 tour × một
      // round-trip là đúng cái N+1 mà `catalog.service` đã né ở đường công khai.
      //
      // Vì sao `findMany` chứ không `groupBy` đếm hộ: nhát cắt thứ hai —
      // `isWithinDeadline` — là luật `N` theo ĐỘ DÀI chuyến (ADR-0041 §2), SQL
      // không biểu diễn được bằng một vị ngữ. Lấy ba cột rồi đếm ở Node, đúng
      // cách `catalog.service.ts` làm cho `priceFrom`.
      prisma.tourDeparture.findMany({
        where: {
          tourId: { in: ids },
          status: DepartureStatus.OPEN,
          startDate: departureWindow(month, now),
        },
        select: { tourId: true, startDate: true, endDate: true },
      }),
    ]);

    // Nhát thứ hai: chuyến đã qua hạn đặt thì KHÔNG đếm. Thiếu nhát này, bảng
    // admin in "2 open departures" cho một tour mà khách vào trang thấy cả hai
    // đều "Booking closed" — hai màn của cùng một hệ thống nói hai chuyện.
    const countByTour = new Map<string, number>();
    for (const d of openCounts) {
      if (!isWithinDeadline(now, calendarDate(d.startDate), calendarDate(d.endDate))) continue;
      countByTour.set(d.tourId, (countByTour.get(d.tourId) ?? 0) + 1);
    }

    return {
      items: tours.map((tour) => ({
        id: tour.id,
        slug: tour.slug,
        title: tour.title,
        categoryName: tour.category.name,
        basePrice: money(tour.basePrice),
        currency: tour.currency,
        isPublished: tour.isPublished,
        isFeatured: tour.isFeatured,
        heroUrl: pickCover(coverMap.get(tour.id))?.url ?? null,
        // `?? 0`: tour không có chuyến nào vắng mặt trong kết quả gom nhóm —
        // thiếu dòng KHÔNG được biến thành thiếu hàng.
        openDepartureCount: countByTour.get(tour.id) ?? 0,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Đưa một tour lên kệ hoặc rút khỏi kệ.
   *
   * KHÔNG có guard nào ngoài "tour có tồn tại không". Gỡ đăng một tour đang có
   * booking sống là HỢP LỆ (spec §3-F11): khách đã mua vẫn đi, tour chỉ thôi
   * được chào bán — và đó đúng là thao tác vận hành cần nhất khi có chuyện.
   *
   * Đọc-rồi-ghi trong CÙNG một transaction, nhưng KHÔNG cần `FOR UPDATE` (khác
   * hẳn luật ghế của F12): phép ghi ở đây là TUYỆT ĐỐI (`isPublished = <đích>`)
   * chứ không phải tương đối, nên hai admin bấm cùng lúc chỉ có thể cùng ghi ra
   * một kết quả — không có lost update nào để mất. Lượt đọc chỉ để trả lời
   * `changed`, và cùng lắm hai người cùng nhận `changed: true` cho một lượt đổi.
   */
  async setTourPublished(input: AdminTourSetPublishedInput): Promise<AdminTourSetPublishedResult> {
    const { id, isPublished } = input;

    const outcome = await prisma.$transaction(async (tx) => {
      const before = await tx.tour.findUnique({
        where: { id },
        select: { slug: true, isPublished: true },
      });
      if (!before) return null;
      if (before.isPublished === isPublished) return { slug: before.slug, changed: false };
      await tx.tour.update({ where: { id }, data: { isPublished } });
      return { slug: before.slug, changed: true };
    });

    if (!outcome) throw new TourNotFoundError();

    // Bust cache web SAU commit, không trong transaction (tiền lệ
    // `reviews.service.ts`): một lượt fetch tới web nằm trong transaction là
    // giữ khoá DB suốt thời gian chờ mạng.
    //
    // Bust KỂ CẢ khi `changed` là false, và đó là chủ đích. `revalidate` là
    // fire-and-forget: mọi thất bại (non-200, timeout 3s, mạng) chỉ thành một
    // dòng `logger.warn`, không ai thấy. Nếu gác bust sau `changed`, lượt bust
    // hỏng sẽ không còn đường chạy lại — admin bấm lại để ép thì đọc-trước-khi-ghi
    // thấy trạng thái đã đúng, trả `changed: false`, và tour ở lại trên site
    // công khai trọn cửa sổ ISR 300 giây mà người vận hành không còn đòn bẩy nào.
    // Một lượt POST thừa rẻ hơn nhiều so với một tour không rút khỏi kệ được.
    void this.webRevalidation.revalidate(tourRevalidationTags(outcome.slug));

    return { id, isPublished, changed: outcome.changed };
  }
}
