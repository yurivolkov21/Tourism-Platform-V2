import { Injectable, Logger } from '@nestjs/common';
import {
  type AdminTourCostsInput,
  type AdminTourCreateInput,
  type AdminTourCreateResult,
  type AdminTourDeleteInput,
  type AdminTourDeleteResult,
  type AdminTourDetail,
  type AdminTourDetailsInput,
  type AdminTourFaqsPoliciesInput,
  type AdminTourItineraryInput,
  derivedCostPrice,
  type MediaItem,
  TOUR_CURRENCY,
  tourReadiness,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType, MediaRole } from '../../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { tourRevalidationTags } from '../web-revalidation/revalidation-decision.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import {
  AdminTourNotFoundError,
  ItineraryDayOutOfRangeError,
  TourHasBookingsError,
  TourLinkNotFoundError,
  TourNotReadyError,
  TourRuleError,
  TourSlugTakenError,
} from './admin-tour-errors.js';
import { costItemsOf } from './tour-cost-items.js';
import { liveSeatsMax } from './tour-editor-rules.js';
import { orderTourPhotos, toAdminTourPhoto } from './tour-photos.js';
import { claimTour, readTourReadiness } from './tour-state.js';

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

function toDetail(row: TourDetailRow, now: Date, media: readonly MediaItem[]): AdminTourDetail {
  const ordered = orderTourPhotos(media);
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
    photos: ordered.map((item) => toAdminTourPhoto(item, env.CLOUDINARY_UPLOAD_FOLDER, row.id)),
    readiness: tourReadiness({
      summary: row.summary,
      destinations: row.destinations,
      durationDays: row.durationDays,
      itineraryDays: row.itinerary.map((day) => day.dayNumber),
      hasCover: ordered.some((item) => item.role === 'hero'),
    }),
  };
}

/** Các cột của tab Details — KHÔNG có slug, tiền tệ, giá gạch, cờ bán, điểm đánh giá, giá vốn. */
function detailsColumns(input: AdminTourDetailsInput) {
  return {
    title: input.title,
    summary: input.summary,
    categoryId: input.categoryId,
    difficulty: input.difficulty,
    isFeatured: input.isFeatured,
    durationDays: input.durationDays,
    maxGroupSize: input.maxGroupSize,
    basePrice: input.basePrice,
    suitableFor: input.suitableFor,
    badges: input.badges,
    highlights: input.highlights,
    included: input.included,
    excluded: input.excluded,
    meetingPoint: input.meetingPoint,
    factDurationNote: input.factDurationNote,
    factGroupSizeNote: input.factGroupSizeNote,
    factDifficultyNote: input.factDifficultyNote,
    factGoodForNote: input.factGoodForNote,
  } satisfies Prisma.TourUncheckedUpdateInput;
}

/** Tour đang bán thì luôn đủ để bán (ADR-0047 §4) — kiểm sau khi ghi, trước commit. */
async function assertStillReady(tx: Prisma.TransactionClient, id: string): Promise<void> {
  const readiness = await readTourReadiness(tx, id);
  if (!readiness.ready) throw new TourNotReadyError(readiness);
}

/** Khoá ngoại hỏng ở lệnh sửa = danh mục hay điểm đến không tồn tại. */
function mapLinkError(error: unknown): never {
  if (prismaCode(error) === 'P2003') throw new TourLinkNotFoundError();
  throw error;
}

@Injectable()
export class AdminToursService {
  private readonly logger = new Logger(AdminToursService.name);

  constructor(
    private readonly webRevalidation: WebRevalidationService,
    private readonly media: MediaService,
  ) {}

  /** Một tour, mọi trạng thái bán — tour tắt bán chính là tour đang được soạn. */
  async get(slug: string): Promise<AdminTourDetail> {
    const row = await prisma.tour.findUnique({ where: { slug }, select: TOUR_DETAIL_SELECT });
    if (!row) throw new AdminTourNotFoundError(slug);
    const media = await this.media.resolveForOwners(
      MediaOwnerType.TOUR,
      [row.id],
      [MediaRole.hero, MediaRole.gallery],
    );
    return toDetail(row, new Date(), media.get(row.id) ?? []);
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
   * Tab Details (spec §2b). Thứ tự trong transaction: giành hàng tour → đọc
   * trạng thái hiện tại DƯỚI khoá → hai luật khớp dữ liệu → xoá ngày thừa nếu
   * giảm số ngày → thay điểm đến → ghi cột (kèm giá vốn nếu đổi số khách) →
   * kiểm "vẫn đủ để bán" nếu đang bán.
   */
  async updateDetails(input: AdminTourDetailsInput): Promise<AdminTourDetail> {
    const now = new Date();
    const slug = await prisma
      .$transaction(async (tx) => {
        const next = await claimTour(tx, input.id, input.version, now);
        const current = await tx.tour.findUniqueOrThrow({
          where: { id: input.id },
          select: {
            slug: true,
            durationDays: true,
            maxGroupSize: true,
            isPublished: true,
            departures: {
              select: { seatsTotal: true, startDate: true, endDate: true, status: true },
            },
          },
        });

        if (input.durationDays !== current.durationDays && current.departures.length > 0) {
          throw new TourRuleError(
            'DURATION_LOCKED',
            'This tour has departures, so its number of days is locked.',
          );
        }
        // Sàn chỉ chặn khi HẠ (spec §2b.2 "tăng thì luôn được", vòng review F17):
        // dữ liệu đã lệch sẵn — chuyến 20 ghế trên tour 12 khách — thì giữ
        // nguyên hay nâng lên vẫn phải lưu được, không thì tab Details khoá cứng.
        const floor = liveSeatsMax(current.departures, now);
        if (
          floor !== null &&
          input.maxGroupSize < floor &&
          input.maxGroupSize < current.maxGroupSize
        ) {
          throw new TourRuleError(
            'GROUP_SIZE_BELOW_SEATS',
            `A departure of this tour has ${floor} seats, so the group size cannot go below ${floor}.`,
          );
        }

        if (input.durationDays < current.durationDays) {
          await tx.tourItineraryDay.deleteMany({
            where: { tourId: input.id, dayNumber: { gt: input.durationDays } },
          });
        }
        await tx.tourDestination.deleteMany({ where: { tourId: input.id } });
        await tx.tourDestination.createMany({
          data: input.destinations.map((link) => ({
            tourId: input.id,
            destinationId: link.destinationId,
            isPrimary: link.isPrimary,
          })),
        });

        // Giá vốn chỉ tính lại khi đổi số khách (spec §3) — mẫu số của nó.
        let costPrice: string | null | undefined;
        if (input.maxGroupSize !== current.maxGroupSize) {
          const rows = await tx.tourCostItem.findMany({
            where: { tourId: input.id },
            select: { amount: true, basis: true },
          });
          costPrice =
            rows.length > 0 ? derivedCostPrice(costItemsOf(rows), input.maxGroupSize) : null;
        }
        await tx.tour.update({
          where: { id: input.id },
          data: {
            ...detailsColumns(input),
            ...(costPrice === undefined ? {} : { costPrice }),
            updatedAt: next,
          },
        });

        if (current.isPublished) await assertStillReady(tx, input.id);
        return current.slug;
      })
      .catch(mapLinkError);

    this.logger.log(`[admin] tour details saved ${JSON.stringify({ id: input.id })}`);
    this.bust(slug);
    return this.get(slug);
  }

  /**
   * Tab Itinerary — thay nguyên. Ngày vượt số ngày là client hỏng (400, quyết
   * định 6); kiểm SAU phép so phiên bản, vì chỉ khi phiên bản khớp thì số ngày
   * client thấy mới đúng là số ngày của tour.
   */
  async setItinerary(input: AdminTourItineraryInput): Promise<AdminTourDetail> {
    const now = new Date();
    const slug = await prisma.$transaction(async (tx) => {
      await claimTour(tx, input.id, input.version, now);
      const current = await tx.tour.findUniqueOrThrow({
        where: { id: input.id },
        select: { slug: true, durationDays: true, isPublished: true },
      });
      const outside = input.days.find((day) => day.dayNumber > current.durationDays);
      if (outside) {
        throw new ItineraryDayOutOfRangeError(
          `Day ${outside.dayNumber} is outside this ${current.durationDays}-day tour.`,
        );
      }

      await tx.tourItineraryDay.deleteMany({ where: { tourId: input.id } });
      await tx.tourItineraryDay.createMany({
        data: input.days.map((day) => ({
          tourId: input.id,
          dayNumber: day.dayNumber,
          title: day.title,
          description: day.description,
        })),
      });

      if (current.isPublished) await assertStillReady(tx, input.id);
      return current.slug;
    });

    this.logger.log(
      `[admin] tour itinerary saved ${JSON.stringify({ id: input.id, days: input.days.length })}`,
    );
    this.bust(slug);
    return this.get(slug);
  }

  /** Tab FAQ & policies — hai danh sách thay nguyên, `order` = vị trí trong danh sách gửi. */
  async setFaqsPolicies(input: AdminTourFaqsPoliciesInput): Promise<AdminTourDetail> {
    const now = new Date();
    const slug = await prisma.$transaction(async (tx) => {
      await claimTour(tx, input.id, input.version, now);
      const { slug } = await tx.tour.findUniqueOrThrow({
        where: { id: input.id },
        select: { slug: true },
      });

      await tx.tourFaq.deleteMany({ where: { tourId: input.id } });
      await tx.tourFaq.createMany({
        data: input.faqs.map((faq, index) => ({
          tourId: input.id,
          question: faq.question,
          answer: faq.answer,
          order: index,
        })),
      });
      await tx.tourPolicy.deleteMany({ where: { tourId: input.id } });
      await tx.tourPolicy.createMany({
        data: input.policies.map((policy, index) => ({
          tourId: input.id,
          kind: policy.kind,
          title: policy.title,
          body: policy.body,
          order: index,
        })),
      });
      return slug;
    });

    this.logger.log(`[admin] tour FAQ and policies saved ${JSON.stringify({ id: input.id })}`);
    this.bust(slug);
    return this.get(slug);
  }

  /**
   * Tab Costs — dòng chi phí thay nguyên, giá vốn tính lại cùng lệnh (ADR-0033,
   * ADR-0047 §8). KHÔNG đụng `fixedCostAmount` của chuyến có sẵn hay
   * `costPerPerson` của booking có sẵn: hai cột ấy là bản chụp (spec §2b).
   */
  async setCosts(input: AdminTourCostsInput): Promise<AdminTourDetail> {
    const now = new Date();
    const slug = await prisma.$transaction(async (tx) => {
      const next = await claimTour(tx, input.id, input.version, now);
      const current = await tx.tour.findUniqueOrThrow({
        where: { id: input.id },
        select: { slug: true, maxGroupSize: true },
      });

      await tx.tourCostItem.deleteMany({ where: { tourId: input.id } });
      await tx.tourCostItem.createMany({
        data: input.items.map((item, index) => ({
          tourId: input.id,
          category: item.category,
          label: item.label,
          amount: item.amount,
          basis: item.basis,
          sortOrder: index,
        })),
      });
      await tx.tour.update({
        where: { id: input.id },
        data: {
          costPrice:
            input.items.length > 0 ? derivedCostPrice(input.items, current.maxGroupSize) : null,
          updatedAt: next,
        },
      });
      return current.slug;
    });

    this.logger.log(
      `[admin] tour costs saved ${JSON.stringify({ id: input.id, items: input.items.length })}`,
    );
    this.bust(slug);
    return this.get(slug);
  }

  /**
   * Bust cache web SAU khi lệnh ghi đã xong (ADR-0016 §3). `void` có chủ đích —
   * đường này chết thì site chỉ kém tươi, còn lệnh ghi đã ăn rồi.
   */
  private bust(slug: string): void {
    void this.webRevalidation.revalidate(tourRevalidationTags(slug));
  }
}
