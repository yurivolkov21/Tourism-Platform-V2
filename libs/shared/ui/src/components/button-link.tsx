import { buttonVariants } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';

/**
 * Một liên kết **trông như** nút. Dùng cái này cho mọi CTA điều hướng.
 *
 * Vì sao cần component riêng thay vì `<Button render={<a href/>} nativeButton={false}>`
 * (đúng mẫu tài liệu Base UI và shadcn): mẫu đó **đè mất role `link` ngầm** của
 * anchor. `useButton` của Base UI gắn thuộc tính theo đúng một nhánh cứng —
 * `isNativeButton ? { type: 'button' } : { role: 'button' }` — nên khi `render`
 * sinh ra `<a>`, phần tử ra lò là `<a href role="button" tabindex="0">`. Trình đọc
 * màn hình đọc "button" cho một thứ **điều hướng sang trang khác**, và người dùng
 * chờ một hành động trong trang. Không có prop nào tắt được: `role` nằm trong
 * chính `getButtonProps`, và `getButtonProps` được merge SAU props ngoài.
 *
 * Trớ trêu là Base UI đã biết về link — cùng file có `isNativeButton ? isButton :
 * !isLink` để **không** tổng hợp click cho anchor (trình duyệt tự làm rồi). Nên
 * bỏ hẳn primitive không mất gì: Enter là hành vi gốc của `<a href>`, còn Space
 * **không** kích hoạt link, và đó mới là hành vi link đúng.
 *
 * Đặt ở FILE RIÊNG, không nhét vào `button.tsx`: `button.tsx` là file vendored từ
 * shadcn, chạy lại `shadcn add button --overwrite` là mất. `buttonVariants` import
 * từ đó nên kiểu dáng vẫn có đúng một nguồn sự thật.
 *
 * Cần `next/link` (điều hướng phía client, prefetch)? Dùng thẳng `buttonVariants`:
 * `<Link className={buttonVariants({ variant: 'outline' })}>`. Component này cố ý
 * chỉ phục vụ `<a>` thuần để không kéo phụ thuộc Next vào thư viện dùng chung.
 */
function ButtonLink({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ComponentProps<'a'> & VariantProps<typeof buttonVariants>) {
  return (
    // `data-slot="button"` giữ nguyên để mọi selector nhắm vào nút cũng thấy nó —
    // đây là nút về mặt kiểu dáng, chỉ khác về ngữ nghĩa.
    <a data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { ButtonLink };
