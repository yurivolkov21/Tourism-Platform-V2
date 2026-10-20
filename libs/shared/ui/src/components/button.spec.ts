import { describe, expect, it } from 'vitest';
import { cn } from '../lib/utils';
import { buttonVariants } from './button';

// Đóng nợ contrast 2.91/2.57 (ADR-0019): nút primary (`variant: 'default'`) ở dark
// KHÔNG đạt được đồng thời 3:1 nền + 4.5:1 chữ. Giải pháp thay thế là viền
// `border-border` phân định không-màu — canh nó có mặt để không bị lùi lại.
//
// Final review (NHÓM 6d): `dark:border` (chỉ đổi border-STYLE) là THỪA — base
// class dùng chung mọi variant (`buttonVariants` gốc) đã có sẵn
// `border border-transparent`, tức border-width/style ĐÃ áp dụng cho MỌI
// theme rồi. Việc còn thiếu riêng ở dark chỉ là MÀU viền, và đó đã là việc
// của `dark:border-border`. Giữ đúng một class, gỡ class thừa.
describe('buttonVariants', () => {
  it('variant default có viền phân định ở dark (đóng nợ contrast 2.91), KHÔNG có class dark:border thừa', () => {
    const classes = buttonVariants({ variant: 'default' }).split(' ');
    expect(classes).toContain('dark:border-border');
    expect(classes).not.toContain('dark:border');
  });

  it('nút khoá bằng focusableWhenDisabled (chỉ mang aria-disabled) cũng mờ và không bắt chuột', () => {
    // Base UI không gắn thuộc tính `disabled` thật cho nút `focusableWhenDisabled`,
    // nên biến thể `disabled:` không bao giờ khớp: nút Save khi chưa sửa gì trông
    // y như nút bấm được (vòng review F17).
    const classes = buttonVariants().split(' ');
    expect(classes).toContain('aria-disabled:opacity-50');
    expect(classes).toContain('aria-disabled:pointer-events-none');
  });
});

// A2-19: JSDoc của `ButtonLink` từng dạy `<Link className={buttonVariants({ variant: 'outline' })}>`.
// Chuỗi trần mang CẢ `border-transparent` của lớp nền lẫn `border-border` của outline; trong
// CSS sinh ra, `border-transparent` đứng sau nên thắng và nút outline mất viền ở giao diện
// sáng. `Button` và `ButtonLink` không dính vì luôn bọc `cn` (tailwind-merge giữ class sau).
describe('buttonVariants dùng ngoài Button/ButtonLink', () => {
  it('chuỗi trần mang hai màu viền đánh nhau', () => {
    const classes = buttonVariants({ variant: 'outline' }).split(' ');
    expect(classes).toContain('border-transparent');
    expect(classes).toContain('border-border');
  });

  it('bọc cn thì chỉ còn viền của outline', () => {
    const classes = cn(buttonVariants({ variant: 'outline' })).split(' ');
    expect(classes).toContain('border-border');
    expect(classes).not.toContain('border-transparent');
  });
});
