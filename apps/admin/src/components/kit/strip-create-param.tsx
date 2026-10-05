'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { CREATE_PARAM, withoutCreateParam } from '@/lib/create-param';

/**
 * Gỡ `?create=1` khỏi URL ngay sau khi trang đã mở hộp tạo (spec 2026-10-05 §2.5) — F5 hay
 * Back không mở lại hộp. Tách thành component riêng để bảng và hộp tạo KHÔNG phải đọc URL
 * (spec của chúng mock `next/navigation` chỉ có `useRouter`).
 */
export function StripCreateParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams.has(CREATE_PARAM)) return;
    router.replace(withoutCreateParam(pathname, searchParams.toString()), { scroll: false });
  }, [router, pathname, searchParams]);

  return null;
}
