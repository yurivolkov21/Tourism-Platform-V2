import { render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginWaves } from './login-waves';

/**
 * Ranh giới lỗi tối giản, đúng vai `error.tsx` của trang: lỗi nào lọt ra khỏi cây là CẢ trang bị
 * thay bằng câu báo lỗi — form đăng nhập đi theo.
 */
class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <p>Something went wrong</p> : this.props.children;
  }
}

describe('LoginWaves — máy không tạo được context WebGL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('nền bỏ trống, trang login còn nguyên', () => {
    // Như trình duyệt chặn WebGL (GPU bị đưa vào danh sách chặn, tắt tăng tốc phần cứng, Chromium
    // không còn tự lùi về SwiftShader): mọi `getContext` trả null.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    // `matchMedia` jsdom không có; `ogl` tự in "unable to create webgl context".
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(
      <PageBoundary>
        <LoginWaves />
        <form aria-label="Sign in" />
      </PageBoundary>,
    );

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeInTheDocument();
    expect(container.querySelector('canvas')).toBeNull();
  });
});
