import { Injectable, Logger } from '@nestjs/common';
import {
  type AdminTourCreateInput,
  type AdminTourCreateResult,
  type AdminTourDeleteInput,
  type AdminTourDeleteResult,
  type AdminTourDetail,
  TOUR_CURRENCY,
  tourReadiness,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { tourRevalidationTags } from '../web-revalidation/revalidation-decision.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import {
  AdminTourNotFoundError,
  TourHasBookingsError,
  TourLinkNotFoundError,
  TourSlugTakenError,
} from './admin-tour-errors.js';
import { liveSeatsMax } from './tour-editor-rules.js';

/**
 * Khu làm việc của MỘT tour phía admin (spec F17, ADR-0047): đọc, tạo, xoá, và
 * bốn lệnh sửa theo tab.
 *
 * Mọi lỗi DB bắt NGAY tại câu ghi, không SELECT kiểm trước (bài học 1–2 của
 * vòng review F14): slug trùng → `P2002`, hàng không còn → `P2025`, khoá ngoại →
 * `P2003`. Kiểm-trước-ghi-sau để hở một cửa sổ, và lỗi ở cửa sổ ấy ra 500.
 *
 * Bust cache web SAU commit, fire-and-forget, hai tag của tour (ADR-0016);
 * lệnh ghi hỏng thì không bust.
 */

/** Tiền ra chuỗi 2 chữ số lẻ — không bao giờ thành số thực (cùng luật `admin-catalog.service.ts`). */
const money = (value: Prisma.Decimal): string => value.toFixed(2);

export function prismaCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

const TOUR_DETAIL_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  categoryId: true,
  difficulty: true,
  isFeatured: true,
  isPublished: true,
  durationDays: true,
  maxGroupSize: true,
  basePrice: true,
  currency: true,
  costPrice: true,
  ratingAvg: true,
  ratingCount: true,
  suitableFor: true,
  badges: true,
  highlights: true,
  included: true,
  excluded: true,
  meetingPoint: true,
  factDurationNote: true,
  factGroupSizeNote: true,
  factDifficultyNote: true,
  factGoodForNote: true,
  updatedAt: true,
  destinations: {
    select: { destinationId: true, isPrimary: true },
    // Điểm chính đứng đầu; còn lại theo tên để thứ tự không tuỳ kế hoạch truy vấn.
    orderBy: [{ isPrimary: 'desc' }, { destination: { name: 'asc' } }],
  },
  itinerary: {
    select: { dayNumber: true, title: true, description: true },
    orderBy: { dayNumber: 'asc' },
  },
  faqs: { select: { question: true, answer: true }, orderBy: [{ order: 'asc' }, { id: 'asc' }] },
  policies: {
    select: { kind: true, title: true, body: true },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  },
  costItems: {
    select: { category: true, label: true, amount: true, basis: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  },
  departures: { select: { seatsTotal: true, startDate: true, endDate: true, status: true } },
  _count: { select: { bookings: true } },
} satisfies Prisma.TourSelect;

type TourDetailRow = Prisma.TourGetPayload<{ select: typeof TOUR_DETAIL_SELECT }>;

function toDetail(row: TourDetailRow, now: Date): AdminTourDetail {
  return {
    id: row.id,
    slug: row.slug,
    version: row.updatedAt.toISOString(),
    title: row.title,
    summary: row.summary,
    categoryId: row.categoryId,
    difficulty: row.difficulty,
    isFeatured: row.isFeatured,
    isPublished: row.isPublished,
    durationDays: row.durationDays,
    maxGroupSize: row.maxGroupSize,
    basePrice: money(row.basePrice),
    currency: row.currency,
    costPrice: row.costPrice ? money(row.costPrice) : null,
    ratingAvg: row.ratingAvg ? row.ratingAvg.toFixed(1) : null,
    ratingCount: row.ratingCount,
    suitableFor: row.suitableFor,
    badges: row.badges,
    highlights: row.highlights,
    included: row.included,
    excluded: row.excluded,
    meetingPoint: row.meetingPoint,
    factDurationNote: row.factDurationNote,
    factGroupSizeNote: row.factGroupSizeNote,
    factDifficultyNote: row.factDifficultyNote,
    factGoodForNote: row.factGoodForNote,
    destinations: row.destinations,
    itinerary: row.itinerary,
    faqs: row.faqs,
    policies: row.policies,
    costItems: row.costItems.map((item) => ({ ...item, amount: money(item.amount) })),
    departureCount: row.departures.length,
    liveSeatsMax: liveSeatsMax(row.departures, now),
    bookingCount: row._count.bookings,
    readiness: tourReadiness({
      summary: row.summary,
      destinations: row.destinations,
      durationDays: row.durationDays,
      itineraryDays: row.itinerary.map((day) => day.dayNumber),
    }),
  };
}

@Injectable()
export class AdminToursService {
  private readonly logger = new Logger(AdminToursService.name);

  constructor(private readonly webRevalidation: WebRevalidationService) {}

  /** Một tour, mọi trạng thái bán — tour tắt bán chính là tour đang được soạn. */
  async get(slug: string): Promise<AdminTourDetail> {
    const row = await prisma.tour.findUnique({ where: { slug }, select: TOUR_DETAIL_SELECT });
    if (!row) throw new AdminTourNotFoundError(slug);
    return toDetail(row, new Date());
  }

  /**
   * Tạo tour ở dạng TẮT bán, một điểm chính, mọi danh sách rỗng, chưa có giá
   * vốn (spec §2a). Không bust: web chưa có trang nào chứa một tour tắt bán.
   */
  async create(input: AdminTourCreateInput): Promise<AdminTourCreateResult> {
    const created = await prisma.tour
      .create({
        data: {
          slug: input.slug,
          title: input.title,
          categoryId: input.categoryId,
          durationDays: input.durationDays,
          maxGroupSize: input.maxGroupSize,
          basePrice: input.basePrice,
          currency: TOUR_CURRENCY,
          isPublished: false,
          destinations: {
            create: [{ destinationId: input.primaryDestinationId, isPrimary: true }],
          },
        },
        select: { id: true, slug: true },
      })
      .catch((error: unknown) => {
        const code = prismaCode(error);
        if (code === 'P2002') throw new TourSlugTakenError(input.slug);
        if (code === 'P2003') throw new TourLinkNotFoundError();
        throw error;
      });

    this.logger.log(`[admin] tour created ${JSON.stringify(created)}`);
    return created;
  }

  /**
   * Xoá thẳng; khoá ngoại `Restrict` của booking là trọng tài (ADR-0047 §5) —
   * không đếm booking trước, vì một booking chen vào giữa câu đếm và câu xoá sẽ
   * mồ côi (spec §4.6). DB tự xoá theo mọi bảng con khai `Cascade`, kể cả đánh
   * giá gắn tour (plan F17, quyết định 4); câu hỏi của khách giữ lại, mất liên
   * kết (`SetNull`). Ảnh của tour không có khoá ngoại — F18 lo.
   */
  async delete(input: AdminTourDeleteInput): Promise<AdminTourDeleteResult> {
    const deleted = await prisma.tour
      .delete({ where: { id: input.id }, select: { slug: true } })
      .catch((error: unknown) => {
        const code = prismaCode(error);
        if (code === 'P2025') throw new AdminTourNotFoundError(input.id);
        if (code === 'P2003') throw new TourHasBookingsError();
        throw error;
      });

    this.logger.log(`[admin] tour deleted ${JSON.stringify({ id: input.id, slug: deleted.slug })}`);
    this.bust(deleted.slug);
    return { slug: deleted.slug };
  }

  /**
   * Bust cache web SAU khi lệnh ghi đã xong (ADR-0016 §3). `void` có chủ đích —
   * đường này chết thì site chỉ kém tươi, còn lệnh ghi đã ăn rồi.
   */
  private bust(slug: string): void {
    void this.webRevalidation.revalidate(tourRevalidationTags(slug));
  }
}
