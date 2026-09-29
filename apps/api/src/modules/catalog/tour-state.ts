import { type TourReadiness, tourReadiness } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType, MediaRole } from '../../generated/prisma/enums.js';
import { AdminTourNotFoundError, StaleTourError } from './admin-tour-errors.js';
import { nextTourVersion } from './tour-editor-rules.js';

/**
 * Hai bước đọc-ghi chạy TRONG transaction của khu làm việc tour (ADR-0047).
 */

/**
 * Câu ĐẦU TIÊN của mọi lệnh sửa: so phiên bản và giành hàng tour trong MỘT câu
 * `UPDATE … WHERE id = ? AND updated_at = ?` (ADR-0047 §3, spec §4.1).
 *
 * Câu ấy vừa so vừa khoá hàng tour tới hết transaction, nên hai lệnh ghi vào
 * cùng tour xếp hàng; lệnh đến sau chạy lại điều kiện trên hàng đã đổi và đếm
 * được 0. Đọc `updatedAt` bằng một câu riêng rồi mới so là để hở đúng cái khe
 * mà int test "hai lệnh cùng version" canh.
 *
 * Đếm 0 thì câu thứ hai chỉ để chọn MÃ: hàng còn thì phiên bản đã cũ, mất thì
 * tour không còn. Trả phiên bản mới để mọi câu ghi sau trong transaction đặt
 * đúng giá trị ấy (Prisma tự đặt `updatedAt` ở mỗi câu ghi nếu không truyền).
 */
export async function claimTour(
  tx: Prisma.TransactionClient,
  id: string,
  version: string,
  now: Date,
): Promise<Date> {
  const next = nextTourVersion(version, now);
  const { count } = await tx.tour.updateMany({
    where: { id, updatedAt: new Date(version) },
    data: { updatedAt: next },
  });
  if (count === 0) {
    const exists = await tx.tour.findUnique({ where: { id }, select: { id: true } });
    throw exists ? new StaleTourError() : new AdminTourNotFoundError(id);
  }
  return next;
}

/**
 * Tour có ảnh bìa không — dòng `media_assets` role `hero` của tour (ADR-0048 §1).
 * Chỉ `readTourReadiness` hỏi, trong transaction đang giữ khoá hàng tour. `get` không
 * hỏi DB: nó đã đọc danh sách ảnh nên suy bằng `pickCover` — cùng định nghĩa "bìa là
 * dòng `hero`" (sửa JSDoc sai và bỏ export thừa, G14 sau vòng review F18).
 */
async function hasTourCover(db: Prisma.TransactionClient, id: string): Promise<boolean> {
  const count = await db.mediaAsset.count({
    where: { ownerType: MediaOwnerType.TOUR, ownerId: id, role: MediaRole.hero },
  });
  return count > 0;
}

/**
 * Độ đủ để bán đọc từ DB, trong transaction đang giữ khoá hàng tour — gọi SAU
 * khi ghi, TRƯỚC commit (spec §4.4), để không lệnh nào chen vào giữa.
 */
export async function readTourReadiness(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<TourReadiness> {
  const row = await tx.tour.findUniqueOrThrow({
    where: { id },
    select: {
      summary: true,
      durationDays: true,
      destinations: { select: { isPrimary: true } },
      itinerary: { select: { dayNumber: true } },
    },
  });
  return tourReadiness({
    summary: row.summary,
    destinations: row.destinations,
    durationDays: row.durationDays,
    itineraryDays: row.itinerary.map((day) => day.dayNumber),
    hasCover: await hasTourCover(tx, id),
  });
}
