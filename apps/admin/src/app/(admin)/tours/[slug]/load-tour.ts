import { cookies } from 'next/headers';
import { cache } from 'react';
import { fetchAdminTour, fetchTourEditorOptions } from '@/lib/api/tours';

/**
 * Hai lượt đọc dùng chung của khu làm việc tour (spec F17 §2g). `cache()` của
 * React gộp các lần gọi CÙNG tham số trong MỘT request server: layout và page
 * cùng hỏi một slug mà chỉ tốn một request API.
 */
export const loadAdminTour = cache(async (slug: string) =>
  fetchAdminTour((await cookies()).toString(), slug),
);

export const loadTourEditorOptions = cache(async () =>
  fetchTourEditorOptions((await cookies()).toString()),
);
