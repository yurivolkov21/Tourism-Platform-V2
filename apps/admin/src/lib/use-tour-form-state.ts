'use client';

import type { AdminTourDetail } from '@tourism/contract';
import { useVersionedForm } from './use-versioned-form';

export { isNewerVersion } from './use-versioned-form';

/**
 * Bộ giữ form của một bước trong khu sửa tour (ADR-0047) — lõi ở `useVersionedForm`, tách
 * ra ở P4e-4 để form bài viết dùng chung. Hành vi không đổi; test của file này canh nó.
 */
export function useTourFormState<Values>(
  detail: AdminTourDetail,
  toValues: (detail: AdminTourDetail) => Values,
) {
  return useVersionedForm(detail, toValues);
}
