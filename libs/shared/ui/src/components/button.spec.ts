import { describe, expect, it } from 'vitest';
import { buttonVariants } from './button';

// Đóng nợ contrast 2.91/2.57 (ADR-0019): nút primary (`variant: 'default'`) ở dark
// KHÔNG đạt được đồng thời 3:1 nền + 4.5:1 chữ. Giải pháp thay thế là viền
// `border-border` phân định không-màu — canh nó có mặt để không bị lùi lại.
describe('buttonVariants', () => {
  it('variant default có viền phân định ở dark — đóng nợ contrast 2.91', () => {
    const classes = buttonVariants({ variant: 'default' }).split(' ');
    expect(classes).toContain('dark:border');
    expect(classes).toContain('dark:border-border');
  });
});
