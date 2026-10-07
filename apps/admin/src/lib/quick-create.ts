'use client';

import { useEffect, useEffectEvent } from 'react';

/**
 * Yêu cầu mở hộp tạo của menu Quick Create (spec 2026-10-05 §2.5). Thay tham số URL cũ (review
 * A2-3, EF1, RU6): bấm ngay trên trang đích, tham số ấy sinh hai mục lịch sử trùng URL, bỏ query
 * lọc đang xem và kéo thêm một lượt render server chỉ để gỡ chính nó khỏi URL.
 *
 * MỘT cơ chế phía client cho cả hai đường:
 * - Khác trang: Link của mục ghi yêu cầu lúc điều hướng phía client THẬT SỰ bắt đầu (`onNavigate`)
 *   rồi đưa sang path trần; trang đích mount thì tiêu thụ yêu cầu và mở hộp. Cú bấm bị hộp
 *   "Discard changes?" chặn, hay bấm kèm phím để mở tab mới, không ghi gì (review G6-F1).
 * - Cùng trang: mục menu ghi yêu cầu mà không điều hướng; trang đang mở nghe và mở hộp ngay —
 *   query lọc giữ nguyên, không thêm mục lịch sử, không lượt render server nào.
 *
 * Yêu cầu nằm trong bộ nhớ của tab (biến module), không trên URL hay storage: F5 xoá nó, còn Back
 * gặp một yêu cầu đã tiêu thụ. Hạn 60 giây, tính từ lúc điều hướng bắt đầu: API gói free ngủ sau
 * 15 phút không ai gọi, lệnh đọc của admin cắt ở 10 giây, Vercel còn khởi động lạnh — trang đích
 * dựng chậm hơn 10 giây là chuyện thường, kể cả lượt "Try again" sau trang lỗi. Quá hạn thì bỏ:
 * điều hướng bỏ dở (trang đích lỗi rồi người dùng đi chỗ khác) không để lần ghé sau mở hộp bất ngờ.
 *
 * KHÔNG import `@tourism/contract`: menu nằm trong chunk sidebar dùng chung của mọi trang (cùng lý
 * do ở `nav.ts`). Chỉ chạm thời gian trong effect và handler, không trong render.
 */
export type CreateKey = 'tour' | 'post' | 'category' | 'destination';

/** Tuổi tối đa của một yêu cầu còn được tiêu thụ (ms) — lý do con số ở JSDoc đầu file. */
const CREATE_REQUEST_TTL_MS = 60_000;

let pending: { key: CreateKey; at: number } | null = null;
const listeners = new Set<(key: CreateKey) => void>();

/**
 * Ghi yêu cầu mở hộp tạo của `key` rồi báo các trang đang nghe. Gọi trong `onNavigate` của Link
 * (khác trang) hay trong handler bấm (cùng trang).
 */
export function requestCreate(key: CreateKey): void {
  pending = { key, at: Date.now() };
  for (const listener of listeners) listener(key);
}

/** Yêu cầu đang chờ khớp `key` thì xoá nó (tươi hay đã quá hạn); trả `true` khi nó còn tươi. */
function take(key: CreateKey): boolean {
  if (pending === null || pending.key !== key) return false;
  const fresh = Date.now() - pending.at <= CREATE_REQUEST_TTL_MS;
  pending = null;
  return fresh;
}

/**
 * Trang vùng mở hộp tạo của nó theo yêu cầu của Quick Create. Lúc mount: có yêu cầu khớp khoá và
 * còn tươi thì tiêu thụ rồi `open()`. Trong lúc mount: nghe yêu cầu mới của khoá ấy (ca cùng
 * trang). `open` đọc bản của lượt render mới nhất, nơi gọi không phải giữ nó ổn định.
 */
export function useCreateRequest(key: CreateKey, open: () => void): void {
  const onRequest = useEffectEvent(open);

  useEffect(() => {
    if (take(key)) onRequest();
    const listener = (requested: CreateKey) => {
      if (requested === key && take(key)) onRequest();
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);
}
