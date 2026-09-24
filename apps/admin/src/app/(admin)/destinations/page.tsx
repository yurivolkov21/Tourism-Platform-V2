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
  setDestinationActiveAction,
  updateDestinationAction,
} from './actions';

/**
 * `/destinations` — điểm đến (spec P4e-2 F15).
 *
 * Server component đúng nếp `/categories`: fetch oRPC kèm cookie forward, rồi
 * truyền một danh sách đã format xuống bảng client. KHÔNG có `searchParams`:
 * bảng này mười tám hàng, không phân trang, không lọc.
 *
 * Fetch hỏng thì page NÉM, và boundary `app/error.tsx` hiện trang báo lỗi kèm
 * nút thử lại — cùng cách `/categories` xử lỗi fetch. Đó cũng là đường của khe
 * deploy (bài học 21): Vercel thường xong trước Render, và trong vài phút ấy
 * màn mới gọi `admin.destinations.*` mà API cũ chưa có.
 *
 * Trang chở cả ba server action xuống bảng (thay vì để component tự import):
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
      <div className="flex flex-col gap-1 px-4 lg:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">{t.list.heading}</h2>
        <p className="text-sm text-muted-foreground">{t.list.subtitle}</p>
      </div>

      <DestinationsTable
        rows={rows.map(toDestinationRowVM)}
        create={createDestinationAction}
        update={updateDestinationAction}
        setActive={setDestinationActiveAction}
      />
    </AdminShell>
  );
}
