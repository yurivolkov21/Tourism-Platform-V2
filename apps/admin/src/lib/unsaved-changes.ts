/**
 * Một cú bấm có phải là "rời trang trong khi form còn thay đổi chưa lưu" không
 * (spec F17 §2i) — THUẦN, để mọi nhánh test được mà không cần DOM.
 *
 * Chỉ bắt điều hướng NỘI BỘ cùng tab: `beforeunload` của trình duyệt đã lo phần
 * rời hẳn (link ra ngoài, đóng tab, gõ địa chỉ), còn link mở tab mới hay tải
 * file thì form ở tab này vẫn còn nguyên.
 */
export interface LeaveClick {
  dirty: boolean;
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** Thẻ `<a href>` gần nhất bao quanh chỗ bấm; `null` khi bấm ngoài link. */
  anchor: { href: string; target: string; hasDownload: boolean } | null;
  /** `location.href` lúc bấm. */
  current: string;
}

/** Đường cần hỏi trước khi đi (pathname + query + hash), hoặc `null` = cứ để đi. */
export function leaveTarget(click: LeaveClick): string | null {
  const { anchor } = click;
  if (!click.dirty || click.defaultPrevented || anchor === null) return null;
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) {
    return null;
  }
  if ((anchor.target !== '' && anchor.target !== '_self') || anchor.hasDownload) return null;
  return leavingPath(click.current, anchor.href);
}

/**
 * Một lượt đi trong lịch sử của tab — nút Back, Forward, hay nhảy nhiều bước từ menu giữ
 * chuột — đọc từ sự kiện `navigate` của Navigation API (G7).
 */
export interface LeaveTraverse {
  dirty: boolean;
  /** `NavigateEvent.navigationType`: 'push' | 'replace' | 'reload' | 'traverse'. */
  navigationType: string;
  /** `NavigateEvent.cancelable` — trình duyệt có cho trang huỷ lượt này không. */
  cancelable: boolean;
  /** `NavigateEvent.destination.url` — URL của mục lịch sử sắp tới. */
  destination: string;
  /** `location.href` lúc sự kiện bắn. */
  current: string;
}

/**
 * Có huỷ lượt đi trong lịch sử này để hỏi lại không. Chỉ huỷ khi trình duyệt cho phép
 * (`cancelable`): một lượt không huỷ được mà vẫn mở hộp hỏi thì hộp hiện ra trên trang
 * đã đổi.
 */
export function blocksTraverse(nav: LeaveTraverse): boolean {
  if (!nav.dirty || nav.navigationType !== 'traverse' || !nav.cancelable) return false;
  return leavingPath(nav.current, nav.destination) !== null;
}

/**
 * Đường đích nếu đi từ `current` sang `next` là rời trang này; `null` khi khác origin
 * (`beforeunload` lo) hoặc chỉ đổi #hash — link tới một ô của CHÍNH trang này.
 */
function leavingPath(current: string, next: string): string | null {
  const here = new URL(current);
  const target = new URL(next, here);
  if (target.origin !== here.origin) return null;
  if (target.pathname === here.pathname && target.search === here.search) return null;
  return `${target.pathname}${target.search}${target.hash}`;
}
