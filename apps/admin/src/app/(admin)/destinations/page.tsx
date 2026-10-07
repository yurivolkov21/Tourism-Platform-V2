import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin-shell';
import { DestinationsTable } from '@/components/destinations/destinations-table';
import { fetchAdminDestinations } from '@/lib/api/destinations';
import { getServerSession } from '@/lib/api/session';
import { toDestinationRowVM } from '@/lib/destinations-view';
import {
  createDestinationAction,
  deleteDestinationAction,
  setDestinationActiveAction,
  updateDestinationAction,
} from './actions';

/**
 * `/destinations` — điểm đến (spec P4e-2 F15).
 *
 * Server component đúng nếp `/categories`: fetch oRPC kèm cookie forward, rồi
 * truyền một danh sách đã format xuống bảng client. KHÔNG có `searchParams`:
 * bảng này mười tám hàng, không phân trang, không lọc. Quick Create mở hộp Add
 * bằng yêu cầu phía client (`lib/quick-create.ts`), không qua URL.
 *
 * Fetch hỏng thì page NÉM, và boundary `app/error.tsx` hiện trang báo lỗi kèm
 * nút thử lại — cùng cách `/categories` xử lỗi fetch. Đó cũng là đường của khe
 * deploy (bài học 21): Vercel thường xong trước Render, và trong vài phút ấy
 * màn mới gọi `admin.destinations.*` mà API cũ chưa có.
 *
 * Trang chở cả bốn server action xuống bảng (thay vì để component tự import):
 * bảng và dialog test được với hàm giả, không phải mock `next/headers`.
 */
const t = messages.admin.destinations;

export const metadata: Metadata = {
  title: 'Destinations — Nexora back office',
};

export default async function DestinationsPage() {
  const cookie = (await cookies()).toString();
  const [session, rows] = await Promise.all([getServerSession(), fetchAdminDestinations(cookie)]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp các trang vùng khác).
  if (!session) return null;

  return (
    <AdminShell user={session}>
      {/* Không còn tiêu đề lớn: thanh tiêu đề của shell đã gọi tên trang, như mọi vùng khác
          (spec 2026-10-05 §4 #11). Câu giải thích giữ lại, thành dòng mờ. */}
      <p className="px-4 text-sm text-muted-foreground lg:px-6">{t.list.subtitle}</p>

      <DestinationsTable
        rows={rows.map(toDestinationRowVM)}
        create={createDestinationAction}
        update={updateDestinationAction}
        setActive={setDestinationActiveAction}
        remove={deleteDestinationAction}
      />
    </AdminShell>
  );
}
