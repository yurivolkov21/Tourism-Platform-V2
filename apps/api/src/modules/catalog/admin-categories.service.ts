import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminCategoryCreateInput,
  AdminCategoryDeleteInput,
  AdminCategoryDeleteResult,
  AdminCategoryMoveInput,
  AdminCategoryRow,
  AdminCategorySetActiveInput,
  AdminCategoryUpdateInput,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ContractError } from '../../lib/contract-error.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';

/**
 * Sáu thao tác quản trị danh mục tour (spec P4e-2 F14).
 *
 * Xoá chỉ khi chưa tour nào dùng (ADR-0053, thay quyết định "chỉ bật/tắt" của spec P4e-2
 * §2a). Khoá ngoại `tours.category_id` khai `RESTRICT`, nên chính câu DELETE là phán quyết.
 */

/**
 * Bốn lỗi của vùng mang sẵn MÃ contract (`ContractError`), nên controller đổi
 * chúng bằng `toContractError` dùng chung thay vì một `mapError` riêng (nợ G3,
 * rút ở F15). Câu "không tìm thấy" không gửi ra ngoài — câu mặc định của
 * contract đã đủ, còn câu này mang id để đọc log; ba câu kia thì gửi, vì
 * chúng mang slug, hướng thật hay lý do không xoá được.
 */
export class CategoryNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(id: string) {
    super('NOT_FOUND', `Category not found: ${id}`, false);
  }
}

/** Slug đã có hàng khác dùng. 409 chứ không 422 — input đúng, thế giới đã đổi. */
export class SlugTakenError extends ContractError<'SLUG_TAKEN'> {
  constructor(slug: string) {
    super('SLUG_TAKEN', `Slug already taken: ${slug}`);
  }
}

/** Đã ở đầu hoặc cuối danh sách, không còn hàng nào để đổi chỗ. */
export class CannotMoveError extends ContractError<'CANNOT_MOVE'> {
  constructor(direction: 'up' | 'down') {
    super(
      'CANNOT_MOVE',
      `This category is already at the ${direction === 'up' ? 'start' : 'end'} of the list`,
    );
  }
}

/** Còn tour (mọi trạng thái) thuộc danh mục — ẩn thay vì xoá (ADR-0053). */
export class CategoryInUseError extends ContractError<'IN_USE'> {
  constructor() {
    super('IN_USE', 'This category is still used by tours');
  }
}

const CATEGORY_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  order: true,
  isActive: true,
} satisfies Prisma.TourCategorySelect;

/**
 * Cùng `CATEGORY_SELECT` nhưng kèm cờ `isPublished` của MỌI tour thuộc danh mục, trong CÙNG
 * một lần đọc với hàng (bài học 3 của vòng review F14). Hai con số suy từ CÙNG một danh
 * sách nên luôn `tourCount ≤ linkedTourCount`: `tourCount` nuôi câu cảnh báo lúc tắt (đếm
 * thứ khách đang thấy), `linkedTourCount` quyết nút Delete (ADR-0053 §5). Danh mục vài
 * hàng, tour vài chục — đọc cờ từng tour rẻ.
 */
const CATEGORY_SELECT_WITH_TOURS = {
  ...CATEGORY_SELECT,
  tours: { select: { isPublished: true } },
} satisfies Prisma.TourCategorySelect;

type CategoryData = Prisma.TourCategoryGetPayload<{ select: typeof CATEGORY_SELECT }>;
type CategoryWithTours = Prisma.TourCategoryGetPayload<{
  select: typeof CATEGORY_SELECT_WITH_TOURS;
}>;

/** Hai con số tour của một hàng — xem `CATEGORY_SELECT_WITH_TOURS`. */
interface TourCounts {
  tourCount: number;
  linkedTourCount: number;
}

function countTours(tours: ReadonlyArray<{ isPublished: boolean }>): TourCounts {
  return {
    tourCount: tours.filter((tour) => tour.isPublished).length,
    linkedTourCount: tours.length,
  };
}

/**
 * Thứ tự đọc danh mục: `order` trước, rồi `id` làm khoá phụ.
 *
 * Khoá phụ KHÔNG thừa: cột `order` là `Int @default(0)` không unique, nên một
 * hàng chèn ngoài service này (seed, SQL tay) có thể ngang số với hàng khác —
 * và Postgres không hứa thứ tự giữa hai hàng ngang nhau. Không có khoá phụ thì
 * bảng admin và hàng chip công khai xếp chúng tuỳ lượt truy vấn, trong khi
 * `canMoveUp`/`canMoveDown` phía client suy THUẦN theo chỉ số mảng.
 */
const CATEGORY_ORDER_BY = [
  { order: 'asc' },
  { id: 'asc' },
] satisfies Prisma.TourCategoryOrderByWithRelationInput[];

/**
 * Khoá tuần tự hoá MỌI lệnh ghi chạm `order` của bảng danh mục.
 *
 * Một khoá cấp BẢNG chứ không phải theo hàng, và là hằng số chứ không băm từ
 * id: ba thao tác cần loại trừ nhau ở đây (`create` tính `max + 1`, `move`
 * đổi chỗ hai hàng, `delete` rút một hàng khỏi tập hàng xóm) đều nói về VỊ TRÍ
 * TƯƠNG ĐỐI của cả danh sách, không về một hàng cụ thể. Sáu hàng và vài lệnh
 * ghi mỗi tháng nên tranh chấp là số không.
 *
 * Giá trị nó mua: mọi lệnh đọc bên trong `fn` nằm SAU khoá THEO CẤU TRÚC. Bản
 * trước dùng `SELECT … FOR UPDATE` sau khi đã đọc hai hàng, nên khoá xếp hàng
 * người ghi mà không bảo vệ dữ liệu đã đọc — hai lượt trên hai cặp giao nhau
 * để lại hai hàng cùng `order`, im lặng và vĩnh viễn.
 *
 * Cùng khuôn `withBookingRefundLock` (ADR-0006 AMEND 2b), timeout ngắn hơn vì
 * ở đây không có lời gọi mạng nào bên trong.
 */
function withCategoryOrderLock<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CATEGORY_ORDER_LOCK_KEY})`;
      return fn(tx);
    },
    { timeout: 10_000, maxWait: 5_000 },
  );
}

/** Khoá advisory của bảng `tour_categories` — một hằng, không trùng khoá nào khác. */
const CATEGORY_ORDER_LOCK_KEY = 414_002n;

/**
 * Hàng DB → hàng contract.
 *
 * `tourCount` đếm tour ĐÃ ĐĂNG, cùng thước với `catalog.listCategories`. Con số
 * này nuôi câu cảnh báo lúc tắt danh mục, nên nó phải đếm đúng thứ khách đang
 * nhìn thấy — đếm cả nháp là nói với admin một con số không ai ngoài kia thấy.
 */
function toRow(row: CategoryData, counts: TourCounts): AdminCategoryRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    order: row.order,
    isActive: row.isActive,
    tourCount: counts.tourCount,
    linkedTourCount: counts.linkedTourCount,
  };
}

/** Hàng đã kèm cờ tour — đếm ngay từ chính lần đọc đã lấy hàng. */
function toRowWithTours(row: CategoryWithTours): AdminCategoryRow {
  return toRow(row, countTours(row.tours));
}

/**
 * Hàng biến mất giữa chừng: Prisma ném `P2025` cho `update` không tìm thấy
 * bản ghi. Bắt ở đây thay vì kiểm tồn tại bằng một câu SELECT riêng — kiểm
 * trước rồi ghi sau là check-then-act, cửa sổ giữa hai câu cho ra `P2025`
 * trần, và `toContractError` chỉ nhận `ContractError` nên admin ăn 500 kèm câu
 * "kết cục không rõ" cho một lệnh chắc chắn KHÔNG chạy.
 */
function asNotFound(error: unknown, id: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return new CategoryNotFoundError(id);
  }
  return error;
}

@Injectable()
export class AdminCategoriesService {
  private readonly logger = new Logger(AdminCategoriesService.name);

  constructor(private readonly webRevalidation: WebRevalidationService) {}

  /** Cả bảng, gồm hàng đã tắt, sắp theo `order` — khác hẳn bề mặt công khai. */
  async list(): Promise<AdminCategoryRow[]> {
    const rows = await prisma.tourCategory.findMany({
      orderBy: CATEGORY_ORDER_BY,
      select: CATEGORY_SELECT_WITH_TOURS,
    });
    return rows.map(toRowWithTours);
  }

  async create(input: AdminCategoryCreateInput): Promise<AdminCategoryRow> {
    const created = await withCategoryOrderLock(async (tx) => {
      // Trong khoá thì `assertSlugFree` mới giữ được lời hứa của nó: bản trước
      // kiểm trong một transaction READ COMMITTED, mà mức ấy không serialize
      // hai INSERT song song — chỉ chỉ mục `@unique` chặn, và `P2002` thì rơi
      // ra ngoài thành 500.
      await assertSlugFree(tx, input.slug);
      // "Thêm vào cuối" là thứ duy nhất có nghĩa khi người tạo chưa thấy danh
      // sách sắp xong — muốn nó lên đầu thì bấm mũi tên, đó là việc của `move`.
      const last = await tx.tourCategory.aggregate({ _max: { order: true } });
      return tx.tourCategory.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          order: (last._max.order ?? 0) + 1,
        },
        select: CATEGORY_SELECT,
      });
    }).catch((error: unknown) => {
      // Lưới cuối cho đường NGOÀI service này — seed, SQL tay — vốn không đi
      // qua khoá ở trên. Không có nó thì `P2002` thành 500, và 500 làm admin
      // phân loại `GENERIC` rồi mất cả form vừa gõ.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new SlugTakenError(input.slug);
      }
      throw error;
    });

    this.logger.log(
      `[admin] category created ${JSON.stringify({ id: created.id, slug: created.slug })}`,
    );
    this.bust();
    // Danh mục vừa tạo chưa thể có tour nào.
    return toRow(created, { tourCount: 0, linkedTourCount: 0 });
  }

  async update(input: AdminCategoryUpdateInput): Promise<AdminCategoryRow> {
    const updated = await prisma.tourCategory
      .update({
        where: { id: input.id },
        data: { name: input.name, description: input.description },
        select: CATEGORY_SELECT_WITH_TOURS,
      })
      .catch((error: unknown) => {
        throw asNotFound(error, input.id);
      });

    this.logger.log(
      `[admin] category updated ${JSON.stringify({ id: input.id, name: input.name })}`,
    );
    this.bust();
    return toRowWithTours(updated);
  }

  async setActive(input: AdminCategorySetActiveInput): Promise<AdminCategoryRow> {
    const updated = await prisma.tourCategory
      .update({
        where: { id: input.id },
        data: { isActive: input.isActive },
        select: CATEGORY_SELECT_WITH_TOURS,
      })
      .catch((error: unknown) => {
        throw asNotFound(error, input.id);
      });

    this.logger.log(
      `[admin] category active ${JSON.stringify({ id: input.id, isActive: input.isActive })}`,
    );
    this.bust();
    return toRowWithTours(updated);
  }

  /**
   * Đổi chỗ với hàng liền kề.
   *
   * Trả về CẢ danh sách đã sắp lại chứ không phải một hàng: một lượt đổi chỗ
   * động tới hai hàng, nên trả một hàng là bắt client tự đoán hàng kia — hoặc
   * tự gọi `list` thêm một lượt.
   *
   * CẢ HAI lệnh đọc nằm trong `withCategoryOrderLock`, và đó là điểm mấu chốt.
   * Bản đầu đọc hai hàng RỒI mới `SELECT … FOR UPDATE`, nên khoá xếp hàng
   * người ghi mà không bảo vệ giá trị đã đọc: hai lượt trên hai cặp giao nhau
   * — (2,3) và (3,4) — để lượt sau ghi bằng ảnh chụp cũ, và hai hàng cùng
   * `order` thì không gì phát hiện được vì cột ấy không unique.
   */
  async move(input: AdminCategoryMoveInput): Promise<AdminCategoryRow[]> {
    await withCategoryOrderLock(async (tx) => {
      const current = await tx.tourCategory.findUnique({
        where: { id: input.id },
        select: { id: true, order: true },
      });
      if (!current) throw new CategoryNotFoundError(input.id);

      // Hàng liền kề theo `order`, không phải theo chỉ số mảng: `order` có thể
      // không liên tục (một hàng bị xoá bằng tay từ thời seed chẳng hạn).
      // Khoá phụ `id` cho ca hai hàng ngang số — xem `CATEGORY_ORDER_BY`.
      const neighbour = await tx.tourCategory.findFirst({
        where:
          input.direction === 'up'
            ? { order: { lt: current.order } }
            : { order: { gt: current.order } },
        orderBy: { order: input.direction === 'up' ? 'desc' : 'asc' },
        select: { id: true, order: true },
      });
      if (!neighbour) throw new CannotMoveError(input.direction);

      // Hai lệnh ghi, không một câu SWAP: giá trị đọc trong khoá nên không ai
      // chen vào giữa được, và hai câu UPDATE đọc dễ hơn một CTE khéo léo.
      await tx.tourCategory.update({ where: { id: current.id }, data: { order: neighbour.order } });
      await tx.tourCategory.update({ where: { id: neighbour.id }, data: { order: current.order } });
    });

    this.logger.log(
      `[admin] category moved ${JSON.stringify({ id: input.id, direction: input.direction })}`,
    );
    this.bust();
    return this.list();
  }

  /**
   * Xoá một danh mục chưa tour nào dùng (ADR-0053 §2). Không SELECT kiểm trước (bài học 1–2
   * của vòng review F14): khoá ngoại `RESTRICT` nổ `P2003` ngay ở câu DELETE khi còn tour
   * (kể cả tour nháp) → `IN_USE`; hàng không còn → `P2025` → `NOT_FOUND`.
   *
   * Chạy trong `withCategoryOrderLock`: xoá một hàng đổi tập hàng xóm mà `move` đọc, nên nó
   * cũng là lệnh ghi chạm vị trí tương đối của danh sách.
   */
  async delete(input: AdminCategoryDeleteInput): Promise<AdminCategoryDeleteResult> {
    const deleted = await withCategoryOrderLock((tx) =>
      tx.tourCategory.delete({ where: { id: input.id }, select: { slug: true } }),
    ).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') throw new CategoryInUseError();
        if (error.code === 'P2025') throw new CategoryNotFoundError(input.id);
      }
      throw error;
    });

    this.logger.log(
      `[admin] category deleted ${JSON.stringify({ id: input.id, slug: deleted.slug })}`,
    );
    this.bust();
    return { slug: deleted.slug };
  }

  /**
   * Bust cache web SAU khi lệnh ghi đã xong (ADR-0016 §3, tiền lệ F11–F13).
   *
   * Tag `tours` chứ không phải một tag riêng: chip lọc danh mục sống trên trang
   * `/tours` và đi cùng vòng đời với danh sách tour ở đó.
   *
   * `void` có chủ đích — đường này chết thì site chỉ kém tươi, còn lệnh ghi đã
   * ăn rồi thì không được phép fail theo.
   */
  private bust(): void {
    void this.webRevalidation.revalidate(['tours']);
  }
}

/**
 * Slug `@unique`: kiểm để trả 409 có nghĩa thay vì để `P2002` làm việc đó.
 *
 * Gọi nó TRONG `withCategoryOrderLock` — chỉ khoá ấy mới làm câu kiểm này
 * đúng. Một mình trong `$transaction` ở mức READ COMMITTED thì hai lệnh tạo
 * song song đều thấy slug trống rồi cùng INSERT; câu SELECT không chặn được
 * gì, chỉ chỉ mục `@unique` chặn.
 */
async function assertSlugFree(tx: Prisma.TransactionClient, slug: string): Promise<void> {
  const taken = await tx.tourCategory.findUnique({ where: { slug }, select: { id: true } });
  if (taken) throw new SlugTakenError(slug);
}
