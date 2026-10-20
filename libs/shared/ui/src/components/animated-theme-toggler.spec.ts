import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnimatedThemeToggler } from './animated-theme-toggler';

// Bản vendored của magicui gõ cứng chữ "Toggle theme" trong nút: chữ sản phẩm nằm ngoài
// `@tourism/i18n` (luật 7), sót lại sau đợt W-09. Gói UI không giữ chữ, app truyền nhãn vào.
describe('AnimatedThemeToggler', () => {
  it('chữ cho trình đọc màn hình lấy từ prop `label`, không gõ cứng', () => {
    const html = renderToStaticMarkup(
      createElement(AnimatedThemeToggler, { label: 'Switch colour scheme' }),
    );
    expect(html).toContain('<span class="sr-only">Switch colour scheme</span>');
    expect(html).not.toContain('Toggle theme');
  });
});
