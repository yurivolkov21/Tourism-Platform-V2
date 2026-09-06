'use client';

import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, withBrowserAuth } from '@/lib/api/client';
import { useSession } from '@/lib/auth-client';
import { signInHref, toggleWished } from '@/lib/wishlist';

interface WishlistState {
  isWished: (tourId: string) => boolean;
  toggle: (tourId: string) => void;
  /** false khi chưa biết trạng thái (chưa hydrate xong / chưa đăng nhập). */
  ready: boolean;
}

const WishlistContext = createContext<WishlistState | null>(null);

/**
 * Nguồn trạng thái wishlist cho MỘT trang danh sách tour.
 *
 * Vì sao là context chứ không phải state trong từng nút: `wishlist.check` là
 * endpoint BATCH (nhận tối đa 100 id) được thiết kế đúng để trang danh sách hỏi
 * MỘT lần cho cả trang. Mỗi nút tự hỏi là quay lại đúng N+1 mà contract đã cố
 * tránh.
 *
 * Vì sao hỏi ở CLIENT sau khi hydrate, không phải ở server component: `/tours`
 * là trang công khai có ISR 300s dùng chung cho mọi khách. Nhét trạng thái
 * theo-từng-người vào đó là vừa hỏng cache vừa rò rỉ wishlist của người này
 * sang người khác. Nên HTML tĩnh luôn ra tim rỗng, rồi client tô lại.
 */
export function WishlistProvider({
  tourIds,
  children,
}: {
  tourIds: readonly string[];
  children: ReactNode;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [wished, setWished] = useState<ReadonlySet<string>>(() => new Set());
  const [ready, setReady] = useState(false);

  const signedIn = Boolean(session?.user);
  // Khoá ổn định để effect không chạy lại mỗi lần render vì mảng mới tham chiếu.
  const idsKey = tourIds.join(',');

  useEffect(() => {
    if (!signedIn || idsKey === '') {
      setWished(new Set());
      setReady(false);
      return;
    }
    let alive = true;
    const ids = idsKey.split(',');
    api.wishlist
      // Trần 100 id của contract — trang nhiều hơn thì cắt, phần dư ra tim rỗng
      // (bấm vẫn lưu được, chỉ là không tô sẵn).
      .check({ tourIds: ids.slice(0, 100) }, { context: withBrowserAuth() })
      .then((res) => {
        if (!alive) return;
        setWished(new Set(res.wishedTourIds));
        setReady(true);
      })
      .catch(() => {
        // Nuốt lỗi CÓ CHỦ ĐÍCH: không tô được tim là mất trang trí, không phải
        // mất chức năng — bấm vẫn lưu được. Ném toast ở đây là quấy khách vì
        // một thứ họ không yêu cầu.
        if (alive) setReady(false);
      });
    return () => {
      alive = false;
    };
  }, [signedIn, idsKey]);

  const isWished = useCallback((tourId: string) => wished.has(tourId), [wished]);

  const toggle = useCallback(
    (tourId: string) => {
      if (!signedIn) {
        router.push(signInHref(pathname, searchParams.toString()));
        return;
      }
      const nextWished = !wished.has(tourId);
      // Optimistic: tim đổi màu ngay, hỏng thì trả lại — cùng khuôn `SavedGrid`.
      setWished((current) => toggleWished(current, tourId));
      api.wishlist
        .set({ tourId, wished: nextWished }, { context: withBrowserAuth() })
        .then(() => {
          toast.success(nextWished ? messages.wishlist.saved : messages.wishlist.removed);
        })
        .catch((error: unknown) => {
          setWished((current) => toggleWished(current, tourId));
          // 429 (AUTHED_WRITE_THROTTLE) có câu riêng: "thử lại" ngay là nạp
          // thêm vào cửa sổ trượt — phải nói "chờ một phút" (vòng vá review 06/09).
          toast.error(
            error instanceof ORPCError && error.status === 429
              ? messages.accountActionErrors.throttle
              : messages.wishlist.error,
          );
        });
    },
    [signedIn, wished, router, pathname, searchParams],
  );

  return (
    <WishlistContext.Provider value={{ isWished, toggle, ready }}>
      {children}
    </WishlistContext.Provider>
  );
}

/**
 * Trả null khi không có provider bao ngoài — component card dùng chung ở nhiều
 * nơi (trang miền, tour liên quan, khu account), không phải chỗ nào cũng muốn
 * nút tim. Card tự ẩn nút khi không có nguồn trạng thái, thay vì vẽ một cái tim
 * không làm gì — đúng nguyên tắc đã ghi ở `tour-card.tsx`.
 */
export function useWishlist(): WishlistState | null {
  return useContext(WishlistContext);
}
