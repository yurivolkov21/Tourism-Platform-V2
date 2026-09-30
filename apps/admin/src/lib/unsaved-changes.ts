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

  const here = new URL(click.current);
  const next = new URL(anchor.href, here);
  if (next.origin !== here.origin) return null;
  // Chỉ đổi #hash (link tới một ô của CHÍNH trang này) thì không phải rời trang.
  if (next.pathname === here.pathname && next.search === here.search) return null;
  return `${next.pathname}${next.search}${next.hash}`;
}
