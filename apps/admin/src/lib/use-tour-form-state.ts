'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { sameValues } from '@/lib/tour-editor-write';

/**
 * State của MỘT form tab trong khu làm việc tour: giá trị các ô, bản gốc để so
 * "có thay đổi", và phiên bản tour mà form đang cầm (spec F17 §2i).
 *
 * Vì sao là hook riêng (vòng review F17): trước đây trang dựng form với
 * `key={detail.version}`, nên mỗi lượt `router.refresh()` mang phiên bản mới về —
 * kể cả lượt refresh ngay sau CHÍNH lần lưu — là React gỡ cả form rồi dựng lại.
 * Nút Save đang giữ tiêu điểm biến mất, chữ gõ trong khe giữa toast và refresh
 * mất im lặng, và công tắc On sale refresh sau khi tab khác lưu cũng xoá sạch
 * bản sửa dở mà không hỏi. Giờ form sống suốt, và bản server mới được đón NGAY
 * TRONG RENDER (cùng khuôn `PublishToggle`):
 *
 * - Props mang phiên bản MỚI hơn form đang cầm, form chưa sửa gì → nạp luôn.
 * - Form đang sửa → giữ chữ, bật `serverChanged` để khung hiện dải "đã có bản
 *   mới" kèm Reload — người dùng chọn, không ai chọn thay.
 * - Cùng phiên bản (refresh sau chính lần lưu) hay phiên bản cũ hơn (refresh về
 *   muộn) → bỏ qua: form đã cầm bản ấy hoặc bản mới hơn.
 *
 * Reload: props đã mới hơn thì nạp ngay; chưa (vd `STALE_TOUR` khi lưu — server
 * mới hơn mà props chưa biết) thì refresh và nạp đè bản mới kế tiếp, TRỪ KHI
 * người dùng gõ thêm sau cú bấm — gõ thêm là đổi ý, không được đè lên.
 */
export function useTourFormState<Values>(
  detail: AdminTourDetail,
  toValues: (detail: AdminTourDetail) => Values,
) {
  const router = useRouter();
  const [base, setBase] = useState<Values>(() => toValues(detail));
  const [values, setRawValues] = useState<Values>(base);
  const [version, setVersion] = useState(detail.version);
  const [showValidation, setShowValidation] = useState(false);
  /** Đã bấm Reload mà bản mới chưa về: bản mới kế tiếp nạp đè cả khi form đang sửa. */
  const [reloading, setReloading] = useState(false);
  const dirty = !sameValues(values, base);

  function adopt(next: AdminTourDetail) {
    const fresh = toValues(next);
    setBase(fresh);
    setRawValues(fresh);
    setVersion(next.version);
    setShowValidation(false);
    setReloading(false);
  }

  const newer = isNewerVersion(detail.version, version);
  // Chỉnh state NGAY TRONG RENDER thay vì `useEffect`: React chạy lại render
  // trước khi vẽ nên không có khung hình nào hiện bản cũ. Hết vòng vì `adopt`
  // đặt `version` bằng đúng phiên bản vừa so.
  if (newer && (!dirty || reloading)) adopt(detail);

  /** Người dùng gõ = đổi ý sau Reload (nếu có) — thôi nạp đè. */
  function setValues(next: Values | ((current: Values) => Values)) {
    setReloading(false);
    setRawValues(next);
  }

  function reload() {
    if (newer) adopt(detail);
    else setReloading(true);
    router.refresh();
  }

  return {
    base,
    values,
    setValues,
    version,
    dirty,
    showValidation,
    setShowValidation,
    adopt,
    reload,
    /** Server đã có bản mới hơn thứ form đang sửa — khung hiện dải stale. */
    serverChanged: newer && dirty && !reloading,
  };
}

/** Phiên bản là `updatedAt` dạng ISO có mili-giây — so theo thời điểm, không theo chữ. */
export function isNewerVersion(candidate: string, current: string): boolean {
  return Date.parse(candidate) > Date.parse(current);
}
