import { act, renderHook } from '@testing-library/react';
import type { AdminTourDetail } from '@tourism/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import { useTourFormState } from './use-tour-form-state';

/**
 * State của một form tab khi bản tour trên server đổi dưới chân nó (vòng review
 * F17). Trước đây trang dựng form với `key={detail.version}`: mỗi lượt
 * `router.refresh()` mang phiên bản mới về là cả form bị gỡ rồi dựng lại — mất
 * tiêu điểm, mất chữ đang gõ, không hỏi gì.
 */
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => refresh() }) }));

beforeEach(() => refresh.mockReset());

const V0 = '2026-09-28T00:00:00.000Z';
const V1 = '2026-09-28T01:00:00.000Z';
const V2 = '2026-09-28T02:00:00.000Z';
const at = (version: string, title: string) => detailFixture({ version, title });
const toValues = (detail: AdminTourDetail) => ({ title: detail.title });

function setup(initial = at(V1, 'Old')) {
  const hook = renderHook(({ detail }) => useTourFormState(detail, toValues), {
    initialProps: { detail: initial },
  });
  const type = (title: string) => act(() => hook.result.current.setValues({ title }));
  return { hook, type };
}

describe('useTourFormState', () => {
  it('mở ra từ bản server: chưa có thay đổi, chưa có gì mới hơn', () => {
    const { hook } = setup();
    expect(hook.result.current.values).toEqual({ title: 'Old' });
    expect(hook.result.current.version).toBe(V1);
    expect(hook.result.current.dirty).toBe(false);
    expect(hook.result.current.serverChanged).toBe(false);
  });

  it('bản server MỚI hơn trôi về khi form chưa sửa → nạp luôn, im lặng', () => {
    const { hook } = setup();

    hook.rerender({ detail: at(V2, 'New') });

    expect(hook.result.current.values).toEqual({ title: 'New' });
    expect(hook.result.current.version).toBe(V2);
    expect(hook.result.current.serverChanged).toBe(false);
  });

  it('bản server mới hơn trôi về khi form ĐANG sửa → giữ chữ, báo serverChanged', () => {
    const { hook, type } = setup();
    type('Mine');

    hook.rerender({ detail: at(V2, 'New') });

    expect(hook.result.current.values).toEqual({ title: 'Mine' });
    expect(hook.result.current.version).toBe(V1);
    expect(hook.result.current.serverChanged).toBe(true);
  });

  it('CÙNG phiên bản trôi về (refresh sau chính lần lưu) → không đụng chữ đang gõ', () => {
    const { hook, type } = setup();
    act(() => hook.result.current.adopt(at(V2, 'Saved')));
    type('Saved, then more');

    hook.rerender({ detail: at(V2, 'Saved') });

    expect(hook.result.current.values).toEqual({ title: 'Saved, then more' });
    expect(hook.result.current.serverChanged).toBe(false);
  });

  it('phiên bản CŨ hơn trôi về (refresh về muộn) → bỏ qua', () => {
    const { hook } = setup();

    hook.rerender({ detail: at(V0, 'Ancient') });

    expect(hook.result.current.values).toEqual({ title: 'Old' });
    expect(hook.result.current.version).toBe(V1);
  });

  it('Reload khi props đã mới hơn → nạp ngay, vẫn refresh', () => {
    const { hook, type } = setup();
    type('Mine');
    hook.rerender({ detail: at(V2, 'New') });

    act(() => hook.result.current.reload());

    expect(hook.result.current.values).toEqual({ title: 'New' });
    expect(hook.result.current.serverChanged).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('Reload khi props chưa mới (STALE từ lần lưu) → refresh; bản mới về thì nạp dù form đang sửa', () => {
    const { hook, type } = setup();
    type('Mine');

    act(() => hook.result.current.reload());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(hook.result.current.values).toEqual({ title: 'Mine' });

    hook.rerender({ detail: at(V2, 'New') });
    expect(hook.result.current.values).toEqual({ title: 'New' });
    expect(hook.result.current.version).toBe(V2);
  });

  it('Reload rồi lại gõ tiếp → bản mới về KHÔNG đè chữ vừa gõ', () => {
    const { hook, type } = setup();
    type('Mine');
    act(() => hook.result.current.reload());
    type('Mine, edited again');

    hook.rerender({ detail: at(V2, 'New') });

    expect(hook.result.current.values).toEqual({ title: 'Mine, edited again' });
    expect(hook.result.current.serverChanged).toBe(true);
  });

  it('nạp bản mới thì tắt cờ hiện lỗi của lần bấm Save trước', () => {
    const { hook } = setup();
    act(() => hook.result.current.setShowValidation(true));

    act(() => hook.result.current.adopt(at(V2, 'Saved')));

    expect(hook.result.current.showValidation).toBe(false);
  });
});
