import { describe, expect, it } from 'vitest';
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
});
