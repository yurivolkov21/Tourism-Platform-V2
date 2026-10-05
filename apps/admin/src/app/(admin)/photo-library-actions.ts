'use server';

import type { AdminPhotoLibrary } from '@tourism/contract';
import { cookies } from 'next/headers';
import { fetchTourPhotoLibrary } from '@/lib/api/tours';
import { classifyWriteError } from '@/lib/api/write-error';
import type { PhotoLibraryResult } from '@/lib/photo-library';

/**
 * Kho ảnh địa danh cho hộp chọn ảnh — MỘT action cho cả tab Photos của tour lẫn ảnh bìa bài
 * viết (vòng review P4e-4: trước đó là hai bản chép nhau từng dòng, ngày thủ tục khai thêm mã
 * lỗi thì bản quên sửa lặng lẽ rơi về GENERIC). Thủ tục không khai mã lỗi, nên chỉ còn lỗi vận
 * chuyển.
 */
export async function loadPhotoLibraryAction(): Promise<PhotoLibraryResult> {
  const cookie = (await cookies()).toString();
  let library: AdminPhotoLibrary;
  try {
    library = await fetchTourPhotoLibrary(cookie);
  } catch (error) {
    return { ok: false, code: classifyWriteError(error, new Set<never>()) };
  }
  return { ok: true, library };
}
