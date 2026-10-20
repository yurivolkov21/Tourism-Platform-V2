'use client';

import type { ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';

type ScrollspyProps = {
  children: ReactNode;
  targetRef?: RefObject<HTMLElement | HTMLDivElement | Document | null | undefined>;
  onUpdate?: (id: string) => void;
  offset?: number;
  smooth?: boolean;
  className?: string;
  dataAttribute?: string;
  history?: boolean;
  throttleTime?: number;
};

/**
 * Vùng cuộn mà scrollspy bám theo. Không có `targetRef`, hoặc `targetRef` trỏ `document`,
 * là cuộn của window. `targetRef` trỏ phần tử thì là phần tử đó, hoặc viewport ScrollArea
 * bên trong nó. `null`: `targetRef` có nhưng chưa gắn phần tử, chưa có gì để bám.
 *
 * Bản gốc chỉ nhận window khi `targetRef.current === document`, nên thiếu `targetRef` thì
 * nhánh theo dõi cuộn trả về sớm và nút không bao giờ sáng theo cuộn. Sổ hành trình ở
 * /account (ca dùng duy nhất) dùng đúng kiểu không `targetRef` đó.
 */
function resolveScroller(targetRef: ScrollspyProps['targetRef']): Window | HTMLElement | null {
  if (!targetRef) return window;
  const current = targetRef.current;
  if (current === document) return window;
  if (!(current instanceof HTMLElement)) return null;
  const viewport = current.querySelector('[data-slot="scroll-area-viewport"]');
  return viewport instanceof HTMLElement ? viewport : current;
}

export function Scrollspy({
  children,
  targetRef,
  onUpdate,
  className,
  offset = 0,
  smooth = true,
  dataAttribute = 'scrollspy',
  history = true,
}: ScrollspyProps) {
  const selfRef = useRef<HTMLDivElement | null>(null);
  const anchorElementsRef = useRef<Element[] | null>(null);

  // Đánh dấu nút đang sáng, gọi onUpdate, và ghi hash khi đi từ một cú bấm.
  //
  // Cuộn KHÔNG ghi hash (bản gốc ghi mỗi khi đổi section): khi nhánh theo dõi cuộn còn
  // hỏng, hash chỉ đổi lúc bấm, và đó là hành vi URL người dùng đã thấy ở /account. Vá
  // nhánh cuộn mà giữ việc ghi hash thì URL nhảy theo từng lần cuộn, kể cả ngay lúc mở
  // trang (lượt dò đầu tiên luôn chọn một nút).
  const setActiveSection = useCallback(
    (sectionId: string | null, fromClick = false) => {
      if (!sectionId) return;
      anchorElementsRef.current?.forEach((item) => {
        const id = item.getAttribute(`data-${dataAttribute}-anchor`);
        if (id === sectionId) {
          item.setAttribute('data-active', 'true');
        } else {
          item.removeAttribute('data-active');
        }
      });
      if (onUpdate) onUpdate(sectionId);
      if (history && fromClick) {
        window.history.replaceState({}, '', `#${sectionId}`);
      }
    },
    [dataAttribute, history, onUpdate],
  );

  const handleScroll = useCallback(() => {
    if (!anchorElementsRef.current || anchorElementsRef.current.length === 0) return;

    const scroller = resolveScroller(targetRef);
    if (!scroller) return;
    const scrollElement =
      scroller === window ? document.documentElement : (scroller as HTMLElement);

    const scrollTop =
      scroller === window
        ? window.scrollY || document.documentElement.scrollTop
        : scrollElement.scrollTop;

    // Đỉnh section trong hệ toạ độ của vùng cuộn. Với window, `offsetTop` chỉ đúng khi
    // offsetParent là body (cùng lý do nhánh bấm bên dưới), nên đo bằng rect + scrollY.
    const sectionTop = (section: HTMLElement) =>
      scroller === window ? section.getBoundingClientRect().top + scrollTop : section.offsetTop;

    // Find the anchor whose section is closest to but not past the top
    let activeIdx = 0;
    let minDelta = Infinity;

    anchorElementsRef.current.forEach((anchor, idx) => {
      const sectionId = anchor.getAttribute(`data-${dataAttribute}-anchor`);
      if (!sectionId) return;
      const sectionElement = document.getElementById(sectionId);
      if (!sectionElement) return;

      let customOffset = offset;
      const dataOffset = anchor.getAttribute(`data-${dataAttribute}-offset`);
      if (dataOffset) customOffset = parseInt(dataOffset, 10);

      const top = sectionTop(sectionElement);
      const delta = Math.abs(top - customOffset - scrollTop);

      if (top - customOffset <= scrollTop && delta < minDelta) {
        minDelta = delta;
        activeIdx = idx;
      }
    });

    // If at bottom, force last anchor
    const scrollHeight = scrollElement.scrollHeight;
    const clientHeight = scrollElement.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 2) {
      activeIdx = anchorElementsRef.current.length - 1;
    }

    // Set only one anchor active and sync the URL hash
    const activeAnchor = anchorElementsRef.current[activeIdx];
    const sectionId = activeAnchor?.getAttribute(`data-${dataAttribute}-anchor`) || null;

    setActiveSection(sectionId);
  }, [targetRef, dataAttribute, offset, setActiveSection]);

  const scrollTo = useCallback(
    (anchorElement: HTMLElement) => (event?: Event) => {
      if (event) event.preventDefault();
      const sectionId =
        anchorElement.getAttribute(`data-${dataAttribute}-anchor`)?.replace('#', '') || null;
      if (!sectionId) return;
      const sectionElement = document.getElementById(sectionId);
      if (!sectionElement) return;

      // Vá bug bản gốc: không có targetRef (bám cuộn WINDOW) thì nhánh này ra
      // `undefined` và cú bấm không cuộn gì cả — chỉ nút đổi màu. Cùng một luật
      // chọn vùng cuộn với nhánh theo dõi cuộn ở trên (`resolveScroller`).
      const scrollToElement = resolveScroller(targetRef);

      let customOffset = offset;
      const dataOffset = anchorElement.getAttribute(`data-${dataAttribute}-offset`);
      if (dataOffset) {
        customOffset = parseInt(dataOffset, 10);
      }

      // Với window, `offsetTop` chỉ đúng khi offsetParent là body — dùng
      // rect + scrollY cho chắc ở mọi cây DOM; vùng cuộn con giữ offsetTop.
      const scrollTop =
        scrollToElement === window
          ? sectionElement.getBoundingClientRect().top + window.scrollY - customOffset
          : sectionElement.offsetTop - customOffset;

      if (scrollToElement && 'scrollTo' in scrollToElement) {
        scrollToElement.scrollTo({
          top: scrollTop,
          left: 0,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
      setActiveSection(sectionId, true);
    },
    [dataAttribute, offset, smooth, targetRef, setActiveSection],
  );

  // Scroll to the section if the ID is present in the URL hash
  const scrollToHashSection = useCallback(() => {
    const hash = CSS.escape(window.location.hash.replace('#', ''));

    if (hash) {
      const targetElement = document.querySelector(
        `[data-${dataAttribute}-anchor="${hash}"]`,
      ) as HTMLElement;
      if (targetElement) {
        scrollTo(targetElement)();
      }
    }
  }, [dataAttribute, scrollTo]);

  useEffect(() => {
    // Query elements and store them in the ref, avoiding unnecessary re-renders
    if (selfRef.current) {
      anchorElementsRef.current = Array.from(
        selfRef.current.querySelectorAll(`[data-${dataAttribute}-anchor]`),
      );
    }

    // Giữ đúng hàm đã gắn để gỡ được: bản gốc gọi `scrollTo(item)` lần nữa khi gỡ, ra một
    // hàm MỚI nên không gỡ gì cả, và mỗi lần effect chạy lại là chồng thêm listener click.
    const clickHandlers = (anchorElementsRef.current ?? []).map((item) => {
      const handler = scrollTo(item as HTMLElement);
      item.addEventListener('click', handler);
      return [item, handler] as const;
    });

    const onScroll = (event: Event) => {
      const scroller = resolveScroller(targetRef);
      if (!scroller) return;

      if (scroller === window || (scroller as HTMLElement).contains(event.target as Node)) {
        handleScroll();
      }
    };

    // Use window listener with capture to catch scroll events from targetRef even if set later
    window.addEventListener('scroll', onScroll, true);

    // Check if there's a hash in the URL and scroll to the corresponding section
    const initialTimeout = setTimeout(() => {
      scrollToHashSection();
      handleScroll();
    }, 100);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      for (const [item, handler] of clickHandlers) {
        item.removeEventListener('click', handler);
      }
      clearTimeout(initialTimeout);
    };
  }, [targetRef, handleScroll, dataAttribute, scrollTo, scrollToHashSection]);

  return (
    <div data-slot="scrollspy" className={className} ref={selfRef}>
      {children}
    </div>
  );
}
