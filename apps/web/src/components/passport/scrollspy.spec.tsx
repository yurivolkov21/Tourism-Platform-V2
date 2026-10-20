import { act, fireEvent, render, screen } from '@testing-library/react';
import { Scrollspy } from '@tourism/ui/components/reui/scrollspy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Scrollspy là component dùng chung (`@tourism/ui`), test đặt ở web vì gói UI chỉ dựng
// môi trường node (cùng lối `content/article-markdown.spec.tsx`). Ca dùng thật duy nhất là
// sổ hành trình ở /account (`travel-log.tsx`): KHÔNG truyền `targetRef`, bám cuộn của window.
//
// jsdom không có layout: vị trí section giả bằng `getBoundingClientRect` (toạ độ theo
// khung nhìn, nên trừ `scrollY`), chiều cao trang và khung nhìn giả trên `<html>`.

const SECTION_TOP = { 'log-a': 1000, 'log-b': 2000, 'log-c': 3000 } as const;
let scrollY = 0;

function setScroll(y: number) {
  scrollY = y;
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

function activeAnchor() {
  return document
    .querySelector('[data-scrollspy-anchor][data-active="true"]')
    ?.getAttribute('data-scrollspy-anchor');
}

function Page({ onUpdate }: { onUpdate?: (id: string) => void }) {
  return (
    <>
      <Scrollspy offset={120} {...(onUpdate ? { onUpdate } : {})}>
        <button type="button" data-scrollspy-anchor="log-a">
          A
        </button>
        <button type="button" data-scrollspy-anchor="log-b">
          B
        </button>
        <button type="button" data-scrollspy-anchor="log-c">
          C
        </button>
      </Scrollspy>
      {Object.keys(SECTION_TOP).map((id) => (
        <section key={id} id={id} />
      ))}
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  scrollY = 0;
  window.history.replaceState(null, '', '/account');
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(6000);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const top = SECTION_TOP[this.id as keyof typeof SECTION_TOP] ?? 0;
    return { top: top - scrollY } as DOMRect;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Scrollspy bám cuộn window (không targetRef, như sổ hành trình)', () => {
  // Trước đây nhánh theo dõi cuộn trả về sớm khi không có `targetRef`: nút địa danh
  // không bao giờ sáng theo cuộn, chỉ sáng khi bấm (đo bằng Playwright ở /account).
  it('nút sáng theo section đang ở đầu khung nhìn', () => {
    render(<Page />);
    act(() => {
      vi.advanceTimersByTime(150);
    });

    setScroll(2100);
    expect(activeAnchor()).toBe('log-b');

    setScroll(3500);
    expect(activeAnchor()).toBe('log-c');

    setScroll(1000);
    expect(activeAnchor()).toBe('log-a');
  });

  it('cuộn tới đáy trang thì sáng nút cuối', () => {
    render(<Page />);
    setScroll(5200);
    expect(activeAnchor()).toBe('log-c');
  });

  // Cuộn không ghi hash: giữ URL như hành vi người dùng đã thấy; chỉ bấm mới ghi.
  it('cuộn không đổi URL, bấm thì ghi hash và cuộn tới section trừ offset', () => {
    render(<Page />);
    setScroll(2100);
    expect(window.location.hash).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(window.location.hash).toBe('#log-c');
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 2880, left: 0, behavior: 'smooth' });
    expect(activeAnchor()).toBe('log-c');
  });

  // `removeEventListener('click', scrollTo(item))` tạo hàm MỚI nên không gỡ được gì: mỗi
  // lần effect chạy lại (đổi `onUpdate`, `offset`…) là chồng thêm một listener click.
  it('render lại với onUpdate mới không chồng listener click', () => {
    const spy = vi.fn();
    const { rerender } = render(<Page onUpdate={(id) => spy(id)} />);
    rerender(<Page onUpdate={(id) => spy(id)} />);
    rerender(<Page onUpdate={(id) => spy(id)} />);
    spy.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('log-b');
  });
});
