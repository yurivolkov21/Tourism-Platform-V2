// File này render React (renderHook) và quan sát DOM nên thuộc project `dom`
// theo ADR-0014 §4, dù không có JSX — đuôi .spec.tsx quyết định project, và
// project `dom` mới nạp vitest.setup.ts (cleanup() của RTL, matchMedia,
// ResizeObserver, matcher jest-dom). Logic thuần đồng bộ (resolveThemeNow)
// vẫn test được ở đây luôn, không cần tách file.
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveThemeNow, useResolvedTheme } from './use-resolved-theme.js';

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('resolveThemeNow', () => {
  it('có class .dark là tối', () => {
    document.documentElement.classList.add('dark');
    expect(resolveThemeNow()).toBe('dark');
  });

  it('VẮNG class .dark là sáng — v2 không bao giờ thêm class `light`', () => {
    document.documentElement.classList.remove('dark');
    expect(resolveThemeNow()).toBe('light');
  });
});

describe('useResolvedTheme', () => {
  it('gỡ .dark thì đổi về sáng — chiều dark→light từng kẹt vì logic bê từ Nexora', async () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useResolvedTheme());
    expect(result.current).toBe('dark');

    document.documentElement.classList.remove('dark');
    await waitFor(() => expect(result.current).toBe('light'));
  });

  it('thêm .dark thì đổi sang tối', async () => {
    const { result } = renderHook(() => useResolvedTheme());
    expect(result.current).toBe('light');

    document.documentElement.classList.add('dark');
    await waitFor(() => expect(result.current).toBe('dark'));
  });
});
