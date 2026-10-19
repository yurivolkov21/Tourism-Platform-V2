import { Logger } from '@nestjs/common';
import {
  ACTIVITY_ACTOR_LABEL_MAX,
  ACTIVITY_LABEL_MAX,
  type ActivityAction,
  activityArea,
} from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { captureException } from '../../lib/observability.js';
import type { ActivityEntry } from './activity-describers.js';

const logger = new Logger('AdminActivity');

/** Người làm của một dòng, chụp lúc ghi (ADR-0061 §1). */
export interface ActivityActor {
  id: string;
  label: string;
  role: UserRole;
}

/** Cắt chuỗi về trần cột — nhãn dài hơn cột là lỗi ghi, mà lỗi ghi không được làm hỏng thao tác. */
function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Người làm lấy từ phiên: nhãn là tên, trống thì email của chính admin ấy (spec §4). Role lạ (phiên
 * không phải admin) thì null — `@AdminImplement` đã chặn trước, đây chỉ là lưới.
 */
export function actorFromSession(user: SessionUser): ActivityActor | null {
  const role = user.role;
  if (role !== UserRole.ADMIN && role !== UserRole.STAFF) return null;
  const name = user.name?.trim();
  return {
    id: user.id,
    label: clip(name ? name : user.email, ACTIVITY_ACTOR_LABEL_MAX),
    role,
  };
}

/** Ghi một dòng; lỗi thì NÉM — dùng ở `recordExport`, nơi người gọi tự quyết. */
export async function insertActivity(
  actor: ActivityActor,
  action: ActivityAction,
  entry: ActivityEntry,
): Promise<string> {
  const details = entry.details && Object.keys(entry.details).length > 0 ? entry.details : null;
  const row = await prisma.adminActivity.create({
    data: {
      actorId: actor.id,
      actorLabel: actor.label,
      actorRole: actor.role,
      action,
      area: activityArea(action),
      targetType: entry.target?.type ?? null,
      targetId: entry.target ? clip(entry.target.id, ACTIVITY_LABEL_MAX) : null,
      targetLabel: entry.target?.label ? clip(entry.target.label, ACTIVITY_LABEL_MAX) : null,
      ...(details ? { details: details as Prisma.InputJsonObject } : {}),
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Ghi sau khi thao tác đã thành công (ADR-0061 §4): lỗi chỉ log một dòng và đẩy Sentry seam, không
 * bao giờ ném — thao tác đã xảy ra, báo lỗi lúc này dễ khiến admin bấm lại và làm hai lần.
 */
export async function recordActivitySafely(
  actor: ActivityActor,
  action: ActivityAction,
  entry: () => Promise<ActivityEntry | null>,
): Promise<void> {
  try {
    const described = await entry();
    if (!described) return;
    await insertActivity(actor, action, described);
  } catch (error) {
    logger.error(
      `Không ghi được nhật ký cho ${action}: ${error instanceof Error ? error.message : String(error)}`,
    );
    captureException(error);
  }
}
