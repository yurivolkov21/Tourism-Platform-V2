'use client';

import type { AdminTourDetail, TourReadiness } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { isUncertainOutcome, type TransportFailureCode } from '@/lib/api/write-error';
import { TOURS_LIST_HREF } from '@/lib/departures-query';
import { type ReadinessIssue, readinessIssues } from '@/lib/tour-editor-view';
import type { EditorWriteResult } from '@/lib/tour-editor-write';

/**
 * Vòng đời MỘT lần Save của một tab (spec F17 §2i) — cùng luật `useConfirmWrite`
 * nhưng cho form nằm trên trang chứ không trong hộp thoại:
 *
 * - `pending` là CỔNG: bấm đúp chỉ bắn một lệnh. Cổng thật là một ref — state
 *   chỉ để vẽ: hai lần gọi trong CÙNG một lượt render đọc chung một `pending`
 *   cũ, ref thì không.
 * - Thành công: form nhận NGUYÊN tour mới (`version` mới) rồi `router.refresh()`
 *   cho phần đầu (readiness, công tắc) theo kịp.
 * - `STALE_TOUR`: dải báo kèm Reload, form GIỮ chữ đang gõ.
 * - `TOUR_NOT_READY`: dải liệt kê chỗ thiếu, tính từ bản dự tính của chính lệnh này.
 * - `NOT_FOUND`: tour đã bị xoá — toast rồi về `/tours`.
 * - Mã thuộc về một ô (`onFieldError` trả `true`): form tự in dưới ô ấy.
 * - Còn lại: dải lỗi; `GENERIC` là kết cục KHÔNG RÕ nên dải mời Reload thay vì bấm lại.
 */
export type SectionBanner =
  | { kind: 'stale' }
  | { kind: 'notReady'; issues: ReadinessIssue[] }
  | { kind: 'error'; message: string; uncertain: boolean };

export function useSectionSave<Code extends string>(options: {
  copy: (code: Code | TransportFailureCode) => string;
  projected: () => TourReadiness;
  slug: string;
  onSaved: (detail: AdminTourDetail) => void;
  onFieldError?: (code: Code) => boolean;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<SectionBanner | null>(null);

  async function save(run: () => Promise<EditorWriteResult<Code>>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setBanner(null);
    let result: EditorWriteResult<Code>;
    try {
      result = await run();
    } catch {
      // Action ném ⇒ không biết lệnh đã đi tới đâu — coi như GENERIC.
      result = { ok: false, code: 'GENERIC' };
    }
    inFlight.current = false;
    setPending(false);

    if (result.ok) {
      options.onSaved(result.detail);
      toast.success(messages.admin.tours.editor.saved);
      router.refresh();
      return;
    }
    const { code } = result;
    if (code === 'STALE_TOUR') {
      setBanner({ kind: 'stale' });
      return;
    }
    if (code === 'TOUR_NOT_READY') {
      setBanner({ kind: 'notReady', issues: readinessIssues(options.projected(), options.slug) });
      return;
    }
    if (code === 'NOT_FOUND') {
      toast.error(options.copy(code));
      router.push(TOURS_LIST_HREF);
      return;
    }
    if (options.onFieldError?.(code as Code)) return;
    setBanner({ kind: 'error', message: options.copy(code), uncertain: isUncertainOutcome(code) });
  }

  return { pending, banner, save };
}
