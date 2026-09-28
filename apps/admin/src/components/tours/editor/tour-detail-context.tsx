'use client';

import type { AdminTourDetail } from '@tourism/contract';
import * as React from 'react';
import { isNewerVersion } from '@/lib/use-tour-form-state';

/**
 * Bản tour mà PHẦN ĐẦU khu làm việc (tên, khung readiness, công tắc) đọc — vòng
 * review F17.
 *
 * Vì sao không đọc thẳng props của layout: lưu xong mà bấm ngay sang tab khác
 * thì Next bỏ lượt `router.refresh()` đang chờ (một lần điều hướng thắng lượt
 * refresh xếp sau), còn layout dùng chung KHÔNG render lại khi đổi tab. Khung
 * readiness và công tắc vì thế kẹt ở bản trước khi lưu — vd vẫn báo thiếu tóm
 * tắt vừa điền. Form đẩy bản server trả về sau mỗi lần lưu vào đây
 * (`usePublishSavedDetail`); lượt refresh chỉ còn là bước thêm.
 *
 * Luật chọn bản: props server mới nhận trừ khi CŨ hơn bản đang có (refresh về
 * muộn); cùng phiên bản thì nhận — bật/tắt bán giữ nguyên phiên bản (plan F17,
 * quyết định 2) nên đó là đường duy nhất `isPublished` mới đi tới.
 */
const DetailContext = React.createContext<AdminTourDetail | null>(null);
const PublishContext = React.createContext<((detail: AdminTourDetail) => void) | null>(null);

export function TourDetailProvider({
  detail,
  children,
}: {
  detail: AdminTourDetail;
  children: React.ReactNode;
}) {
  const [latest, setLatest] = React.useState(detail);
  const [seen, setSeen] = React.useState(detail);
  // Props mới từ một lượt render lại của layout — chỉnh state ngay trong render.
  if (detail !== seen) {
    setSeen(detail);
    if (!isNewerVersion(latest.version, detail.version)) setLatest(detail);
  }

  const publish = React.useCallback((next: AdminTourDetail) => {
    setLatest((current) => (isNewerVersion(current.version, next.version) ? current : next));
  }, []);

  return (
    <PublishContext.Provider value={publish}>
      <DetailContext.Provider value={latest}>{children}</DetailContext.Provider>
    </PublishContext.Provider>
  );
}

/** Bản tour mới nhất cho phần đầu — chỉ dùng BÊN TRONG `TourDetailProvider`. */
export function useWorkspaceDetail(): AdminTourDetail {
  const detail = React.useContext(DetailContext);
  if (detail === null) throw new Error('useWorkspaceDetail must be used inside TourDetailProvider');
  return detail;
}

/** Form đẩy bản vừa lưu lên phần đầu. Ngoài provider (form dựng một mình) là no-op. */
export function usePublishSavedDetail(): (detail: AdminTourDetail) => void {
  return React.useContext(PublishContext) ?? noop;
}

function noop() {}
