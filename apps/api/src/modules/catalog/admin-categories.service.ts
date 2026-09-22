import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminCategoryCreateInput,
  AdminCategoryMoveInput,
  AdminCategoryRow,
  AdminCategorySetActiveInput,
  AdminCategoryUpdateInput,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';

/**
 * Năm thao tác quản trị danh mục tour (spec P4e-2 F14).
 *
 * KHÔNG có lệnh xoá, và đó là quyết định chứ không phải thiếu sót: `is_active`
 * đã có sẵn ở DB và bề mặt công khai đã lọc theo nó, nên tắt là đảo ngược được
 * bằng một cú bấm. Xoá thì không — mà khoá ngoại `tours.category_id` khai
 * `RESTRICT`, nên một lệnh xoá cũng sẽ chết ở DB với câu trả lời dành cho máy.
 */

export class CategoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Category not found: ${id}`);
  }
}

/** Slug đã có hàng khác dùng. 409 chứ không 422 — input đúng, thế giới đã đổi. */
export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Slug already taken: ${slug}`);
  }
}

/** Đã ở đầu hoặc cuối danh sách, không còn hàng nào để đổi chỗ. */
export class CannotMoveError extends Error {
  constructor(direction: 'up' | 'down') {
    super(`This category is already at the ${direction === 'up' ? 'start' : 'end'} of the list`);
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

type CategoryData = Prisma.TourCategoryGetPayload<{ select: typeof CATEGORY_SELECT }>;

/**
 * Hàng DB → hàng contract.
 *
 * `tourCount` đếm tour ĐÃ ĐĂNG, cùng thước với `catalog.listCategories`. Con số
 * này nuôi câu cảnh báo lúc tắt danh mục, nên nó phải đếm đúng thứ khách đang
 * nhìn thấy — đếm cả nháp là nói với admin một con số không ai ngoài kia thấy.
 */
function toRow(row: CategoryData, tourCount: number): AdminCategoryRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    order: row.order,
    isActive: row.isActive,
    tourCount,
  };
}

@Injectable()
export class AdminCategoriesService {
  private readonly logger = new Logger(AdminCategoriesService.name);

  constructor(private readonly webRevalidation: WebRevalidationService) {}

  /** Cả bảng, gồm hàng đã tắt, sắp theo `order` — khác hẳn bề mặt công khai. */
  async list(): Promise<AdminCategoryRow[]> {
    const rows = await prisma.tourCategory.findMany({
      orderBy: { order: 'asc' },
      select: {
        ...CATEGORY_SELECT,
        _count: { select: { tours: { where: { isPublished: true } } } },
      },
    });
    return rows.map((row) => toRow(row, row._count.tours));
  }

  async create(input: AdminCategoryCreateInput): Promise<AdminCategoryRow> {
    const created = await prisma.$transaction(async (tx) => {
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
    });

    this.logger.log(
      `[admin] category created ${JSON.stringify({ id: created.id, slug: created.slug })}`,
    );
    this.bust();
    // Danh mục vừa tạo chưa thể có tour nào.
    return toRow(created, 0);
  }

  async update(input: AdminCategoryUpdateInput): Promise<AdminCategoryRow> {
    await this.assertExists(input.id);
    const updated = await prisma.tourCategory.update({
      where: { id: input.id },
      data: { name: input.name, description: input.description },
      select: CATEGORY_SELECT,
    });

    this.logger.log(
      `[admin] category updated ${JSON.stringify({ id: input.id, name: input.name })}`,
    );
    this.bust();
    return this.withCount(updated);
  }

  async setActive(input: AdminCategorySetActiveInput): Promise<AdminCategoryRow> {
    await this.assertExists(input.id);
    const updated = await prisma.tourCategory.update({
      where: { id: input.id },
      data: { isActive: input.isActive },
      select: CATEGORY_SELECT,
    });

    this.logger.log(
      `[admin] category active ${JSON.stringify({ id: input.id, isActive: input.isActive })}`,
    );
    this.bust();
    return this.withCount(updated);
  }

  /**
   * Đổi chỗ với hàng liền kề.
   *
   * Trả về CẢ danh sách đã sắp lại chứ không phải một hàng: một lượt đổi chỗ
   * động tới hai hàng, nên trả một hàng là bắt client tự đoán hàng kia — hoặc
   * tự gọi `list` thêm một lượt.
   *
   * Cả hai hàng khoá bằng `FOR UPDATE` **sắp theo id**, không theo `order`.
   * Thứ tự khoá cố định là thứ giữ cho hai lượt ngược chiều (một người đẩy
   * hàng 2 xuống, người kia đẩy hàng 3 lên) không ôm nhau chết.
   */
  async move(input: AdminCategoryMoveInput): Promise<AdminCategoryRow[]> {
    await prisma.$transaction(async (tx) => {
      const current = await tx.tourCategory.findUnique({
        where: { id: input.id },
        select: { id: true, order: true },
      });
      if (!current) throw new CategoryNotFoundError(input.id);

      // Hàng liền kề theo `order`, không phải theo chỉ số mảng: `order` có thể
      // không liên tục (một hàng bị xoá bằng tay từ thời seed chẳng hạn).
      const neighbour = await tx.tourCategory.findFirst({
        where:
          input.direction === 'up'
            ? { order: { lt: current.order } }
            : { order: { gt: current.order } },
        orderBy: { order: input.direction === 'up' ? 'desc' : 'asc' },
        select: { id: true, order: true },
      });
      if (!neighbour) throw new CannotMoveError(input.direction);

      const [first, second] = [current, neighbour].sort((a, b) => (a.id < b.id ? -1 : 1));
      if (!first || !second) throw new CannotMoveError(input.direction);
      await tx.$queryRaw`
        SELECT id FROM tour_categories
        WHERE id IN (${first.id}::uuid, ${second.id}::uuid)
        ORDER BY id
        FOR UPDATE
      `;

      // Hai lệnh ghi, không một câu SWAP: giá trị đã đọc trong khoá nên không
      // ai chen vào giữa được, và hai câu UPDATE đọc dễ hơn một CTE khéo léo.
      await tx.tourCategory.update({ where: { id: current.id }, data: { order: neighbour.order } });
      await tx.tourCategory.update({ where: { id: neighbour.id }, data: { order: current.order } });
    });

    this.logger.log(
      `[admin] category moved ${JSON.stringify({ id: input.id, direction: input.direction })}`,
    );
    this.bust();
    return this.list();
  }

  private async assertExists(id: string): Promise<void> {
    const found = await prisma.tourCategory.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new CategoryNotFoundError(id);
  }

  private async withCount(row: CategoryData): Promise<AdminCategoryRow> {
    const tourCount = await prisma.tour.count({
      where: { categoryId: row.id, isPublished: true },
    });
    return toRow(row, tourCount);
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

/** Slug `@unique`: kiểm TRONG transaction để hai lệnh tạo cùng lúc không cùng lọt. */
async function assertSlugFree(tx: Prisma.TransactionClient, slug: string): Promise<void> {
  const taken = await tx.tourCategory.findUnique({ where: { slug }, select: { id: true } });
  if (taken) throw new SlugTakenError(slug);
}
