import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminDestinationCreateInput,
  AdminDestinationRow,
  AdminDestinationSetActiveInput,
  AdminDestinationUpdateInput,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ContractError } from '../../lib/contract-error.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';

/**
 * Bốn thao tác quản trị điểm đến (spec P4e-2 F15).
 *
 * KHÔNG có lệnh xoá, và ở bảng này đó là chuyện an toàn dữ liệu chứ không chỉ
 * là chuyện tiện: khoá ngoại `tour_destinations_destination_id_fkey` khai
 * `ON DELETE CASCADE`, nên DB sẽ không chặn một lệnh xoá mà im lặng gỡ điểm
 * đến khỏi mọi tour. Ẩn (`is_active`) thì đảo ngược được, và mọi liên kết tour
 * còn nguyên (spec §2a).
 *
 * Khác danh mục ở một chỗ đáng kể: bảng này không có cột `order`, nên không có
 * khoá advisory nào. Mỗi lệnh ghi là MỘT câu, và mọi lỗi của nó bắt NGAY tại
 * câu ấy (bài học 1–2 của vòng review F14):
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

/**
 * Cột của một hàng, KÈM số tour đã đăng trong CÙNG câu (bài học 3 của vòng
 * review F14).
 *
 * Đếm ở câu riêng sau lệnh ghi là đọc từ một ảnh chụp KHÁC: một tour publish
 * chen vào giữa thì hàng trả về mang `tourCount` chưa từng khớp trạng thái nào
 * của DB — mà chính con số ấy nuôi câu cảnh báo lúc ẩn điểm đến.
 *
 * Đếm tour ĐÃ ĐĂNG, cùng thước với `catalog.listDestinations`: câu cảnh báo nói
 * về thứ khách đang nhìn thấy, và tour nháp thì không ai thấy.
 */
const DESTINATION_SELECT = {
  id: true,
  slug: true,
  name: true,
  country: true,
  region: true,
  description: true,
  isActive: true,
  _count: { select: { tours: { where: { tour: { isPublished: true } } } } },
} satisfies Prisma.DestinationSelect;

type DestinationWithCount = Prisma.DestinationGetPayload<{ select: typeof DESTINATION_SELECT }>;

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
function toRow(row: DestinationWithCount): AdminDestinationRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    country: row.country,
    region: row.region,
    description: row.description,
    isActive: row.isActive,
    tourCount: row._count.tours,
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
    return rows.map(toRow);
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
        select: DESTINATION_SELECT,
      })
      .catch((error: unknown) => {
        if (isPrismaCode(error, 'P2002')) throw new DestinationSlugTakenError(input.slug);
        throw error;
      });

    this.logger.log(
      `[admin] destination created ${JSON.stringify({ id: created.id, slug: created.slug })}`,
    );
    this.bust();
    return toRow(created);
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
        select: DESTINATION_SELECT,
      })
      .catch((error: unknown) => {
        if (isPrismaCode(error, 'P2025')) throw new DestinationNotFoundError(input.id);
        throw error;
      });

    this.logger.log(
      `[admin] destination updated ${JSON.stringify({ id: input.id, region: input.region })}`,
    );
    this.bust();
    return toRow(updated);
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
        select: DESTINATION_SELECT,
      })
      .catch((error: unknown) => {
        if (isPrismaCode(error, 'P2025')) throw new DestinationNotFoundError(input.id);
        throw error;
      });

    this.logger.log(
      `[admin] destination active ${JSON.stringify({ id: input.id, isActive: input.isActive })}`,
    );
    this.bust();
    return toRow(updated);
  }

  /**
   * Bust cache web SAU khi lệnh ghi đã xong (ADR-0016 §3, tiền lệ F11–F14).
   *
   * Tag `tours` là đủ cho mọi trang đọc danh sách điểm đến: `fetchDestinations`
   * của web gắn đúng tag ấy (trang chủ, `/destinations`, ba trang vùng,
   * `/tours`, About, blog, hộ chiếu của khách).
   *
   * `void` có chủ đích — đường này chết thì site chỉ kém tươi, còn lệnh ghi đã
   * ăn rồi thì không được phép fail theo.
   */
  private bust(): void {
    void this.webRevalidation.revalidate(['tours']);
  }
}
