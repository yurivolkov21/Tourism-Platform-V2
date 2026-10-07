import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CREATE_REQUEST_TTL_MS,
  type CreateKey,
  requestCreate,
  useCreateRequest,
} from './quick-create';

/**
 * Yêu cầu mở hộp tạo của Quick Create — cơ chế phía client thay tham số URL cũ (review A2-3,
 * EF1, RU6).
 *
 * Yêu cầu sống ở biến module nên mọi ca trong file dùng chung nó. Mỗi ca bắt đầu ở một giờ mới
 * (đồng hồ giả chỉ thay `Date`), nên yêu cầu còn treo của ca trước luôn đã quá hạn.
 */
let clock = Date.UTC(2026, 9, 7, 8);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock += 60 * 60 * 1000;
  vi.setSystemTime(clock);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Một trang vùng đang mở, nghe yêu cầu của khoá `key`. */
function mountPage(key: CreateKey) {
  const open = vi.fn();
  const hook = renderHook(() => useCreateRequest(key, open));
  return { open, unmount: hook.unmount };
}

describe('useCreateRequest', () => {
  it('khác trang: yêu cầu đang chờ lúc trang đích mount → mở hộp đúng MỘT lần; Back về trang thì không mở lại', () => {
    requestCreate('tour');

    const page = mountPage('tour');
    expect(page.open).toHaveBeenCalledTimes(1);
    page.unmount();

    // Trang dựng lại (Back, hay ghé lại sau) gặp một yêu cầu đã tiêu thụ.
    expect(mountPage('tour').open).not.toHaveBeenCalled();
  });

  it('yêu cầu tròn 10 giây vẫn còn tươi', () => {
    requestCreate('category');
    vi.setSystemTime(clock + CREATE_REQUEST_TTL_MS);

    expect(mountPage('category').open).toHaveBeenCalledTimes(1);
  });

  it('yêu cầu quá 10 giây thì bỏ — vd bị hộp "Discard changes?" chặn rồi người dùng chọn ở lại, ghé trang đích sau đó không mở hộp bất ngờ', () => {
    requestCreate('category');
    vi.setSystemTime(clock + CREATE_REQUEST_TTL_MS + 1);

    expect(mountPage('category').open).not.toHaveBeenCalled();
  });

  it('yêu cầu của khoá khác thì bỏ qua, cả lúc mount lẫn lúc đang nghe', () => {
    requestCreate('post');
    const page = mountPage('tour');
    expect(page.open).not.toHaveBeenCalled();

    act(() => requestCreate('destination'));
    expect(page.open).not.toHaveBeenCalled();
  });

  it('cùng trang: trang đang mở mở hộp NGAY khi menu ghi yêu cầu, và yêu cầu đã tiêu thụ', () => {
    const page = mountPage('post');
    expect(page.open).not.toHaveBeenCalled();

    act(() => requestCreate('post'));
    expect(page.open).toHaveBeenCalledTimes(1);

    page.unmount();
    expect(mountPage('post').open).not.toHaveBeenCalled();
  });

  it('trang gỡ thì thôi nghe — yêu cầu ghi sau đó không gọi vào trang đã gỡ', () => {
    const page = mountPage('destination');
    page.unmount();

    requestCreate('destination');
    expect(page.open).not.toHaveBeenCalled();
  });

  it('gọi `open` của lượt render mới nhất, không phải bản lúc mount', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const hook = renderHook(({ open }) => useCreateRequest('tour', open), {
      initialProps: { open: first },
    });
    hook.rerender({ open: latest });

    act(() => requestCreate('tour'));

    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
