import { Injectable } from '@nestjs/common';
import {
  type ActivityDetails,
  ActivityDetailsSchema,
  type AdminActivityActorOption,
  type AdminActivityItem,
  type AdminActivityListQuery,
  type AdminActivityListResult,
  type AdminActivityRecordExportInput,
  exportActivityAction,
  isSiteImageSlotKey,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { createdAtRange } from '../../lib/created-at-range.js';
import { toPaged } from '../../lib/paged.js';
import { type ActivityActor, insertActivity } from './activity-recorder.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ActivityRow = Prisma.AdminActivityGetPayload<object>;

/** Nhóm id theo loại đối tượng của một trang nhật ký, để đọc `ref` theo lô. */
type IdsByType = Map<string, Set<string>>;

/**
 * `details` đọc từ jsonb: dòng nào lệch khuôn (không thể có qua đường ghi, nhưng là dữ liệu cũ thì
 * không ai hứa) thành object rỗng — một dòng hỏng không được làm hỏng cả trang.
 */
function toDetails(value: Prisma.JsonValue | null): ActivityDetails {
  const parsed = ActivityDetailsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

/**
 * Nhật ký thao tác admin (ADR-0061 §7): đọc cho trang `/activity` (chỉ Owner) và ghi lượt xuất
 * Excel mà route của app admin báo (§5). Dòng của lệnh ghi do interceptor tự ghi, không qua đây.
 */
@Injectable()
export class ActivityService {
  async list(query: AdminActivityListQuery): Promise<AdminActivityListResult> {
    const { page, limit, actorId, area, from, to } = query;
    const range = createdAtRange(from, to);
    const where: Prisma.AdminActivityWhereInput = {
      ...(actorId ? { actorId } : {}),
      ...(area ? { area } : {}),
      ...(range ? { createdAt: range } : {}),
    };
    const [total, rows, actors] = await Promise.all([
      prisma.adminActivity.count({ where }),
      prisma.adminActivity.findMany({
        where,
        // uuid7 tăng theo thời gian nên `id` là phân xử ổn định khi hai dòng cùng mili-giây.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.actors(),
    ]);
    const refs = await this.refs(rows);
    const items = rows.map((row) => this.toItem(row, refs));
    return { ...toPaged(items, { page, limit, total }), actors };
  }

  /** Ghi một lượt xuất; lỗi thì ném — route của admin tự log và vẫn giao file (spec §7). */
  async recordExport(
    actor: ActivityActor,
    input: AdminActivityRecordExportInput,
  ): Promise<{ id: string }> {
    const action = exportActivityAction(input.kind);
    const details: ActivityDetails =
      input.kind === 'reports'
        ? { month: input.month }
        : { rows: input.rows, mode: input.mode, filtered: input.filtered };
    const id = await insertActivity(actor, action, { target: null, details });
    return { id };
  }

  /**
   * Người làm có trong nhật ký, cho ô lọc People: nhãn và bậc của dòng MỚI NHẤT của mỗi người.
   * Dòng mất tài khoản (`actor_id` null) không lọc theo người được nên không vào danh sách.
   */
  private async actors(): Promise<AdminActivityActorOption[]> {
    const rows = await prisma.$queryRaw<{ id: string; label: string; role: UserRole }[]>(Prisma.sql`
      SELECT DISTINCT ON (actor_id) actor_id AS id, actor_label AS label, actor_role AS role
      FROM admin_activity
      WHERE actor_id IS NOT NULL
      ORDER BY actor_id, created_at DESC`);
    return rows
      .map((row) => ({ id: row.id, label: row.label, role: row.role }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en'));
  }

  /**
   * Khoá đường HIỆN TẠI của từng đối tượng còn tồn tại (spec §5): một lượt đọc cho mỗi loại có
   * trang riêng. Loại không có trang (review, email, danh mục, ảnh, người nhận tin) không đọc.
   */
  private async refs(rows: ActivityRow[]): Promise<Map<string, string>> {
    const ids: IdsByType = new Map();
    for (const row of rows) {
      if (!row.targetType || !row.targetId) continue;
      const set = ids.get(row.targetType) ?? new Set<string>();
      set.add(row.targetId);
      ids.set(row.targetType, set);
    }
    const uuids = (type: string) => [...(ids.get(type) ?? [])].filter((id) => UUID_RE.test(id));
    const refs = new Map<string, string>();
    const put = (type: string, id: string, ref: string) => refs.set(`${type}:${id}`, ref);

    const [tours, posts, destinations, departures, bookings, enquiries, accounts] =
      await Promise.all([
        prisma.tour.findMany({
          where: { id: { in: uuids('tour') } },
          select: { id: true, slug: true },
        }),
        prisma.post.findMany({
          where: { id: { in: uuids('post') } },
          select: { id: true, slug: true },
        }),
        prisma.destination.findMany({
          where: { id: { in: uuids('destination') } },
          select: { id: true, slug: true },
        }),
        prisma.tourDeparture.findMany({
          where: { id: { in: uuids('departure') } },
          select: { id: true, tour: { select: { slug: true } } },
        }),
        prisma.booking.findMany({
          where: { code: { in: [...(ids.get('booking') ?? [])] } },
          select: { code: true },
        }),
        prisma.enquiry.findMany({ where: { id: { in: uuids('enquiry') } }, select: { id: true } }),
        // Tài khoản đã tombstone không còn trang chi tiết.
        prisma.user.findMany({
          where: { id: { in: uuids('account') }, deletedAt: null },
          select: { id: true },
        }),
      ]);
    for (const row of tours) put('tour', row.id, row.slug);
    for (const row of posts) put('post', row.id, row.slug);
    for (const row of destinations) put('destination', row.id, row.slug);
    for (const row of departures) put('departure', row.id, row.tour.slug);
    for (const row of bookings) put('booking', row.code, row.code);
    for (const row of enquiries) put('enquiry', row.id, row.id);
    for (const row of accounts) put('account', row.id, row.id);
    for (const key of ids.get('slot') ?? []) if (isSiteImageSlotKey(key)) put('slot', key, key);
    return refs;
  }

  private toItem(row: ActivityRow, refs: Map<string, string>): AdminActivityItem {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actor: { id: row.actorId, label: row.actorLabel, role: row.actorRole },
      action: row.action,
      area: row.area,
      target:
        row.targetType && row.targetId
          ? {
              type: row.targetType,
              id: row.targetId,
              label: row.targetLabel,
              ref: refs.get(`${row.targetType}:${row.targetId}`) ?? null,
            }
          : null,
      details: toDetails(row.details),
    };
  }
}
