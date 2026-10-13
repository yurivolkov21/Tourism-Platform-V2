import { Injectable, Logger } from '@nestjs/common';
import {
  type AdminUserByIdInput,
  type AdminUserDetail,
  type AdminUserLockInput,
  type AdminUserLockResult,
  type AdminUserRevokeSessionsResult,
  type AdminUserRow,
  type AdminUserSetRoleInput,
  type AdminUserSetRoleResult,
  type AdminUsersListQuery,
  type AdminUserUnlockResult,
  type Paged,
  type UserAction,
  userActions,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { UserEventType, UserRole } from '../../generated/prisma/enums.js';
import { escapeLike } from '../../lib/like.js';
import { toPaged } from '../../lib/paged.js';
import { UserNotFoundError, UserStateChangedError } from './admin-user-errors.js';
import { DETAIL_SELECT, ROW_SELECT, toAdminUserDetail, toAdminUserRow } from './admin-user-row.js';

/** Hàng `users` đã khoá `FOR UPDATE` — đúng ba cột `userActions` cần. */
interface ClaimedUser {
  role: UserRole;
  email_verified: boolean;
  locked_at: Date | null;
}

/**
 * Vùng Users của admin (P4f, ADR-0052). Đọc: danh sách và chi tiết. Ghi: bốn lệnh, mỗi lệnh
 * MỘT transaction — khoá hàng, hỏi `userActions`, ghi, xoá phiên khi cần, nối đúng một dòng
 * `user_events`. Sự kiện ghi được mà thao tác không (hay ngược lại) là lịch sử nói dối.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  /**
   * Một trang tài khoản còn sống (tombstone không bao giờ có mặt), MỚI NHẤT trước. `search`
   * khớp tên HOẶC email không phân biệt hoa thường, qua `escapeLike` — email có `_` là
   * chuyện thường và `%` gõ vào không được thành ký tự đại diện.
   */
  async list(query: AdminUsersListQuery): Promise<Paged<AdminUserRow>> {
    const { page, limit, view, search } = query;
    const term = search ? escapeLike(search) : undefined;
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(view === 'staff' ? { role: UserRole.STAFF } : {}),
      ...(view === 'locked' ? { lockedAt: { not: null } } : {}),
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: ROW_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const lastActive = await this.lastActiveByUser(rows.map((row) => row.id));
    return toPaged(
      rows.map((row) => toAdminUserRow(row, lastActive.get(row.id) ?? null)),
      { page, limit, total },
    );
  }

  async byId(id: string): Promise<AdminUserDetail> {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: DETAIL_SELECT,
    });
    if (!user) throw new UserNotFoundError(id);
    const [active, last] = await Promise.all([
      prisma.session.count({ where: { userId: id, expiresAt: { gt: new Date() } } }),
      prisma.session.aggregate({ where: { userId: id }, _max: { updatedAt: true } }),
    ]);
    return toAdminUserDetail(user, { active, lastActiveAt: last._max.updatedAt });
  }

  /** CUSTOMER → STAFF (`grantStaff`) hoặc STAFF → CUSTOMER (`revokeStaff`, kèm xoá mọi phiên). */
  async setRole(
    actor: { id: string },
    input: AdminUserSetRoleInput,
  ): Promise<AdminUserSetRoleResult> {
    const action: UserAction = input.role === 'STAFF' ? 'grantStaff' : 'revokeStaff';
    await prisma.$transaction(async (tx) => {
      await this.claim(tx, input.id, action);
      await tx.user.update({
        where: { id: input.id },
        data: { role: input.role === 'STAFF' ? UserRole.STAFF : UserRole.CUSTOMER },
      });
      // Bất biến ADR-0026 AMEND 1 §D: hạ quyền LUÔN kèm thu hồi phiên.
      if (action === 'revokeStaff') await tx.session.deleteMany({ where: { userId: input.id } });
      await tx.userEvent.create({
        data: {
          userId: input.id,
          actorId: actor.id,
          type: action === 'grantStaff' ? UserEventType.STAFF_GRANTED : UserEventType.STAFF_REVOKED,
        },
      });
    });
    this.audit(action, actor.id, input.id);
    return { id: input.id, role: input.role };
  }

  /** Khoá: đặt mốc, xoá mọi phiên NGAY trong cùng transaction, ghi lý do vào dòng LOCKED. */
  async lock(actor: { id: string }, input: AdminUserLockInput): Promise<AdminUserLockResult> {
    const lockedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await this.claim(tx, input.id, 'lock');
      await tx.user.update({ where: { id: input.id }, data: { lockedAt } });
      await tx.session.deleteMany({ where: { userId: input.id } });
      await tx.userEvent.create({
        data: {
          userId: input.id,
          actorId: actor.id,
          type: UserEventType.LOCKED,
          note: input.reason,
        },
      });
    });
    this.audit('lock', actor.id, input.id);
    return { id: input.id, lockedAt: lockedAt.toISOString() };
  }

  async unlock(actor: { id: string }, input: AdminUserByIdInput): Promise<AdminUserUnlockResult> {
    await prisma.$transaction(async (tx) => {
      await this.claim(tx, input.id, 'unlock');
      await tx.user.update({ where: { id: input.id }, data: { lockedAt: null } });
      await tx.userEvent.create({
        data: { userId: input.id, actorId: actor.id, type: UserEventType.UNLOCKED },
      });
    });
    this.audit('unlock', actor.id, input.id);
    return { id: input.id };
  }

  /** Đăng xuất mọi nơi — 0 phiên vẫn là thành công (người bấm muốn "không còn phiên nào"). */
  async revokeSessions(
    actor: { id: string },
    input: AdminUserByIdInput,
  ): Promise<AdminUserRevokeSessionsResult> {
    const revoked = await prisma.$transaction(async (tx) => {
      await this.claim(tx, input.id, 'revokeSessions');
      const { count } = await tx.session.deleteMany({ where: { userId: input.id } });
      await tx.userEvent.create({
        data: { userId: input.id, actorId: actor.id, type: UserEventType.SESSIONS_REVOKED },
      });
      return count;
    });
    this.audit('revokeSessions', actor.id, input.id);
    return { id: input.id, revoked };
  }

  /**
   * `SELECT … FOR UPDATE` rồi hỏi `userActions` (plan P4f, quyết định 2; nếp
   * `AdminEnquiriesService.setStatus`): hai lệnh trên cùng một người xếp hàng, nên lệnh sau
   * thấy trạng thái lệnh trước vừa ghi. Luật hợp lệ chỉ sống ở `userActions` — không chép
   * lại vào `where` của từng câu ghi.
   */
  private async claim(tx: Prisma.TransactionClient, id: string, action: UserAction): Promise<void> {
    const [target] = await tx.$queryRaw<ClaimedUser[]>(Prisma.sql`
      SELECT role, email_verified, locked_at FROM users
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      FOR UPDATE
    `);
    if (!target) throw new UserNotFoundError(id);
    const allowed = userActions({
      role: target.role,
      emailVerified: target.email_verified,
      lockedAt: target.locked_at,
    });
    if (!allowed.includes(action)) throw new UserStateChangedError(id, action);
  }

  /** `max(sessions.updated_at)` theo người — một câu `groupBy` cho cả trang. */
  private async lastActiveByUser(ids: string[]): Promise<Map<string, Date>> {
    if (ids.length === 0) return new Map();
    const groups = await prisma.session.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _max: { updatedAt: true },
    });
    const result = new Map<string, Date>();
    for (const group of groups) {
      if (group._max.updatedAt) result.set(group.userId, group._max.updatedAt);
    }
    return result;
  }

  /** Dòng log quy hành vi về người — nếp `[admin] enquiry status`. */
  private audit(action: UserAction, adminId: string, userId: string): void {
    this.logger.log(`[admin] user ${action} ${JSON.stringify({ adminId, userId })}`);
  }
}
