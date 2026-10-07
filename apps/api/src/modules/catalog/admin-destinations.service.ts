import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminDestinationCreateInput,
  AdminDestinationDeleteInput,
  AdminDestinationDeleteResult,
  AdminDestinationRow,
  AdminDestinationSetActiveInput,
  AdminDestinationUpdateInput,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType } from '../../generated/prisma/enums.js';
import { ContractError } from '../../lib/contract-error.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import { countTours, type TourCounts, writtenTags } from './destination-tour-links.js';

/**
 * Năm thao tác quản trị điểm đến (spec P4e-2 F15).
 *
 * Xoá chỉ khi chưa tour nào dùng (ADR-0053, thay quyết định "chỉ ẩn" của spec P4e-2 §2a).
 * Khoá ngoại `tour_destinations_destination_id_fkey` khai `ON DELETE CASCADE` nên DB KHÔNG
 * chặn — `delete` khoá hàng điểm đến rồi đếm liên kết trong cùng transaction.
 *
 * Khác danh mục ở một chỗ đáng kể: bảng này không có cột `order`, nên không có
 * khoá advisory nào. Mỗi lệnh ghi ngoài `delete` là MỘT câu, và mọi lỗi của nó
 * bắt NGAY tại câu ấy (bài học 1–2 của vòng review F14):
 *
 * - slug trùng → `P2002` từ chỉ mục `@unique`. Không SELECT kiểm trước: ở READ
 *   COMMITTED câu ấy không chặn được hai INSERT song song, và `P2002` lọt ra
 *   ngoài thành 500 — admin phân loại `GENERIC` rồi mất cả form vừa gõ.
 * - id không còn → `P2025` từ chính câu `update`. Không kiểm tồn tại trước:
 *   check-then-act để hở một cửa sổ giữa hai câu, và lỗi ở cửa sổ ấy ra 500.
 */

export class DestinationNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(id: string) {
    super('NOT_FOUND', `Destination not found: ${id}`, false);
  }
}

/** Slug đã có hàng khác dùng. 409 chứ không 422 — input đúng, thế giới đã đổi. */
export class DestinationSlugTakenError extends ContractError<'SLUG_TAKEN'> {
  constructor(slug: string) {
    super('SLUG_TAKEN', `Another destination already uses the slug ${slug}`);
  }
}

/** Còn tour (mọi trạng thái) gắn điểm đến — ẩn thay vì xoá (ADR-0053). */
export class DestinationInUseError extends ContractError<'IN_USE'> {
  constructor() {
    super('IN_USE', 'This destination is still used by tours');
  }
}

const DESTINATION_COLUMNS = {
  id: true,
  slug: true,
  name: true,
  country: true,
  region: true,
  description: true,
  isActive: true,
} satisfies Prisma.DestinationSelect;

/**
 * Cột của một hàng KÈM cờ `isPublished` của mọi tour gắn nó, đọc trong chính lời gọi Prisma
 * lấy (hay ghi) hàng — không bằng một câu đếm riêng chạy sau lệnh ghi (bài học 3 của vòng
 * review F14). Đó KHÔNG phải một ảnh chụp: Prisma 7.8 đọc hàng, liên kết `tour_destinations`
 * và tour bằng ba câu SQL nối nhau (đo 06/10), nên giữa chúng vẫn có khe — tour bị xoá đúng
 * lúc ấy về thành `tour: null`, xem `destination-tour-links.ts`.
 *
 * `tourCount` (tour ĐÃ ĐĂNG, nuôi câu cảnh báo lúc ẩn) và `linkedTourCount` (mọi trạng thái,
 * quyết nút Delete — ADR-0053 §5) vẫn luôn `tourCount ≤ linkedTourCount`, vì cả hai đếm trên
 * CÙNG MỘT mảng liên kết, chứ không nhờ ảnh chụp.
 *
 * `tourCount` đếm tour ĐÃ ĐĂNG, cùng thước với `catalog.listDestinations`: câu cảnh
 * báo nói về thứ khách đang nhìn thấy, và tour nháp thì không ai thấy.
 */
const DESTINATION_SELECT = {
  ...DESTINATION_COLUMNS,
  tours: { select: { tour: { select: { isPublished: true } } } },
} satisfies Prisma.DestinationSelect;

/**
 * Lệnh sửa và lệnh ẩn/hiện đọc thêm slug của MỌI tour gắn điểm đến, trong chính lời gọi ghi:
 * trang chi tiết `/tours/<slug>` in tên điểm đến qua tag `tour:<slug>`, nên bust riêng
 * `tours` thì trang ấy giữ tên cũ tới hết 300 giây ISR (nợ G5, đóng ở vòng review F15).
 */
const DESTINATION_WRITE_SELECT = {
  ...DESTINATION_COLUMNS,
  tours: { select: { tour: { select: { slug: true, isPublished: true } } } },
} satisfies Prisma.DestinationSelect;

type DestinationColumns = Prisma.DestinationGetPayload<{ select: typeof DESTINATION_COLUMNS }>;

/**
 * Sắp theo tên như bề mặt công khai (`catalog.listDestinations`), cộng `id` làm
 * khoá phụ: `name` không unique, và hai hàng trùng tên thì Postgres trả theo thứ
 * tự tuỳ kế hoạch truy vấn.
 */
const DESTINATION_ORDER_BY = [
  { name: 'asc' },
  { id: 'asc' },
] satisfies Prisma.DestinationOrderByWithRelationInput[];

/** Hàng DB → hàng contract. `region` đi nguyên văn — chuẩn hoá là việc của người đọc. */
function toRow(row: DestinationColumns, counts: TourCounts): AdminDestinationRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    region: row.region,
    description: row.description,
    isActive: row.isActive,
    tourCount: counts.tourCount,
    linkedTourCount: counts.linkedTourCount,
  };
}

function isPrismaCode(error: unknown, code: 'P2002' | 'P2025'): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

@Injectable()
export class AdminDestinationsService {
  private readonly logger = new Logger(AdminDestinationsService.name);

  constructor(private readonly webRevalidation: WebRevalidationService) {}

  /** Cả bảng, gồm hàng đã ẩn — khác hẳn bề mặt công khai. */
  async list(): Promise<AdminDestinationRow[]> {
    const rows = await prisma.destination.findMany({
      orderBy: DESTINATION_ORDER_BY,
      select: DESTINATION_SELECT,
    });
    return rows.map((row) => toRow(row, countTours(row.tours)));
  }

  async create(input: AdminDestinationCreateInput): Promise<AdminDestinationRow> {
    const created = await prisma.destination
      .create({
        data: {
          slug: input.slug,
          name: input.name,
          country: input.country,
          region: input.region,
          description: input.description,
        },
        select: DESTINATION_COLUMNS,
      })
      .catch((error: unknown) => {
        if (isPrismaCode(error, 'P2002')) throw new DestinationSlugTakenError(input.slug);
        throw error;
      });

    this.logger.log(
      `[admin] destination created ${JSON.stringify({ id: created.id, slug: created.slug })}`,
    );
    this.bust(['tours']);
    // Điểm đến vừa tạo chưa thể có tour nào — không đếm (cùng nếp danh mục).
    return toRow(created, { tourCount: 0, linkedTourCount: 0 });
  }

  async update(input: AdminDestinationUpdateInput): Promise<AdminDestinationRow> {
    const updated = await prisma.destination
      .update({
        where: { id: input.id },
        data: {
          name: input.name,
          country: input.country,
          region: input.region,
          description: input.description,
        },
        select: DESTINATION_WRITE_SELECT,
      })
      .catch((error: unknown) => {
        if (isPrismaCode(error, 'P2025')) throw new DestinationNotFoundError(input.id);
        throw error;
      });

    this.logger.log(
      `[admin] destination updated ${JSON.stringify({ id: input.id, region: input.region })}`,
    );
    this.bust(writtenTags(updated.tours));
    return toRow(updated, countTours(updated.tours));
  }

  /**
   * Ẩn hoặc hiện — ĐÚNG MỘT cột. Liên kết `tour_destinations` không bị đụng tới:
   * tour vẫn gắn điểm đến ấy, vẫn in nó trên lộ trình, và link cũ
   * `/tours?destinations=<slug>` vẫn lọc đúng (int spec canh cả hai điều).
   */
  async setActive(input: AdminDestinationSetActiveInput): Promise<AdminDestinationRow> {
    const updated = await prisma.destination
      .update({
        where: { id: input.id },
        data: { isActive: input.isActive },
        select: DESTINATION_WRITE_SELECT,
      })
      .catch((error: unknown) => {
        if (isPrismaCode(error, 'P2025')) throw new DestinationNotFoundError(input.id);
        throw error;
      });

    this.logger.log(
      `[admin] destination active ${JSON.stringify({ id: input.id, isActive: input.isActive })}`,
    );
    this.bust(writtenTags(updated.tours));
    return toRow(updated, countTours(updated.tours));
  }

  /**
   * Xoá một điểm đến chưa tour nào dùng (ADR-0053 §3–4), MỘT transaction:
   *
   * 1. `SELECT … FOR UPDATE` hàng điểm đến — câu chèn liên kết tour mới phải giành
   *    `FOR KEY SHARE` trên chính hàng ấy (phép kiểm khoá ngoại), mà hai khoá này xung đột,
   *    nên không lệnh gắn nào chen vào giữa lúc đếm và lúc xoá. Lệnh gắn đến SAU lượt xoá
   *    thì nhận `P2003`, khu sửa tour đổi thành `LINK_NOT_FOUND` (`TourLinkNotFoundError`) —
   *    mã riêng của "danh mục hay điểm đến không còn", không phải `NOT_FOUND` của tour.
   * 2. Đếm `tour_destinations` ở statement SAU khoá (snapshot mới, thấy mọi thứ đã commit);
   *    còn dòng → `IN_USE`.
   * 3. Xoá dòng `media_assets` chủ `DESTINATION` (bảng đa chủ, không khoá ngoại). KHÔNG
   *    `requeue` publicId nào: ảnh thư viện là ảnh catalog dùng chung, tour mượn nó bằng
   *    dòng của riêng tour (ADR-0048 §3, §6).
   * 4. Xoá điểm đến.
   */
  async delete(input: AdminDestinationDeleteInput): Promise<AdminDestinationDeleteResult> {
    const deleted = await prisma.$transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<{ slug: string }[]>(Prisma.sql`
          SELECT slug FROM destinations WHERE id = ${input.id}::uuid FOR UPDATE
        `);
        if (!locked) throw new DestinationNotFoundError(input.id);
        const links = await tx.tourDestination.count({ where: { destinationId: input.id } });
        if (links > 0) throw new DestinationInUseError();
        await tx.mediaAsset.deleteMany({
          where: { ownerType: MediaOwnerType.DESTINATION, ownerId: input.id },
        });
        await tx.destination.delete({ where: { id: input.id } });
        return locked;
      },
      { timeout: 10_000, maxWait: 5_000 },
    );

    this.logger.log(
      `[admin] destination deleted ${JSON.stringify({ id: input.id, slug: deleted.slug })}`,
    );
    // Không tour nào gắn điểm đến này nên không có trang `tour:<slug>` nào phải bust kèm.
    this.bust(['tours']);
    return { slug: deleted.slug };
  }

  /**
   * Bust cache web SAU khi lệnh ghi đã xong (ADR-0016 §3, tiền lệ F11–F14).
   *
   * Tag `tours` phủ mọi trang đọc danh sách điểm đến: `fetchDestinations` của
   * web gắn đúng tag ấy (trang chủ, `/destinations`, ba trang vùng, `/tours`,
   * About, blog, hộ chiếu của khách). Lệnh sửa và ẩn/hiện cộng thêm
   * `tour:<slug>` của mọi tour gắn điểm đến (`writtenTags`).
   *
   * `void` có chủ đích — đường này chết thì site chỉ kém tươi, còn lệnh ghi đã
   * ăn rồi thì không được phép fail theo.
   */
  private bust(tags: string[]): void {
    void this.webRevalidation.revalidate(tags);
  }
}
