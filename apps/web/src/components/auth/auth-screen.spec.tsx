import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SiteMediaItem } from '@/lib/api/site-media';
import { AUTH_PANEL_SLOT } from '@/lib/api/site-media';
import { AuthScreen } from './auth-screen';

/**
 * Canh DÂY NỐI của panel ảnh auth, không canh kiểu dáng.
 *
 * Vì sao đáng có test: bản đầu của cụm này hardcode `ImagePlaceholder`, nên
 * khe `auth-panel` có ảnh mà trang vẫn vẽ ô giữ chỗ — hỏng mà KHÔNG có lỗi
 * nào. Sau đó lại hỏng lần hai vì hằng khoá khe đặt trong file `'use client'`
 * (Next biến nó thành client-reference proxy khi server component import).
 * Cả hai lần đều im lặng, nên bất biến ở đây phát biểu theo chiều dương: có
 * ảnh thì phải render ảnh; không có thì phải còn ô giữ chỗ.
 */

const IMAGE = {
  url: 'https://res.cloudinary.com/demo/image/upload/v1/tourism/catalog/site/auth-panel',
  alt: null,
  width: 2400,
  height: 1600,
  type: 'IMAGE',
} as unknown as SiteMediaItem;

describe('AuthScreen — panel ảnh', () => {
  it('có ảnh khe → render ảnh thật, KHÔNG còn ô giữ chỗ', () => {
    const { container } = render(
      <AuthScreen image={IMAGE} quote="Welcome back." author="Mai">
        <p>form</p>
      </AuthScreen>,
    );
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('khe trống → vẫn còn ô giữ chỗ, trang không vỡ', () => {
    const { container } = render(
      <AuthScreen image={null} quote="Welcome back." author="Mai">
        <p>form</p>
      </AuthScreen>,
    );
    // Ô giữ chỗ mang icon ảnh; không có <img> thật nào.
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/Fansipan summit/i)).toBeInTheDocument();
  });

  it('quote và tên người nói luôn hiện — đó mới là nội dung THẬT của panel', () => {
    render(
      <AuthScreen image={IMAGE} quote="The valley kept your seat." author="Mai, Sa Pa guide">
        <p>form</p>
      </AuthScreen>,
    );
    expect(screen.getByText(/The valley kept your seat/)).toBeInTheDocument();
    expect(screen.getByText(/Mai, Sa Pa guide/)).toBeInTheDocument();
  });

  it('children (form) được render', () => {
    render(
      <AuthScreen image={null} quote="q" author="a">
        <button type="button">Board the trip</button>
      </AuthScreen>,
    );
    expect(screen.getByRole('button', { name: /board the trip/i })).toBeInTheDocument();
  });
});

describe('hằng khoá khe', () => {
  /**
   * Ghim giá trị chuỗi: sáu trang auth tra `Map` bằng hằng này, mà `Map.has`
   * với khoá sai chỉ trả false chứ không báo lỗi — gõ nhầm là hỏng im lặng.
   */
  it('AUTH_PANEL_SLOT đúng khoá đã đăng ký trong DB', () => {
    expect(AUTH_PANEL_SLOT).toBe('auth-panel');
    expect(typeof AUTH_PANEL_SLOT).toBe('string');
  });
});
