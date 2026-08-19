/**
 * Đưa đầu một danh sách phân trang về ngay dưới navbar khi đổi trang.
 *
 * Bệnh chung của ba explorer (/blog, /tours, /destinations/[region], đo
 * 19/08): bấm số trang thì lưới thay nội dung TẠI CHỖ nhưng khung hình vẫn
 * đứng ở toạ độ thanh phân trang cũ — người dùng phải tự cuộn ngược lên tìm
 * bài đầu của trang mới; trang mới ngắn hơn thì footer nhảy lên ngay dưới mắt.
 * Mọi phân trang tử tế đều cuộn về đầu danh sách; gom một chỗ để ba nơi
 * không lệch nhau về offset và hành vi.
 *
 * `NAV_OFFSET` 128px = navbar pill fixed + lề: article-body/faq dùng
 * `scroll-mt-28` (112) cho TIÊU ĐỀ vốn có lề trên; thẻ trong lưới mở đầu bằng
 * ẢNH sát mép nên chừa thêm 16px kẻo mép ảnh chui dưới bóng pill (đo ảnh chụp).
 *
 * Dùng `window.scrollTo` (cùng API với `ScrollToTop`, đã sống chung với Lenis)
 * chứ không `scrollIntoView` — cái sau tự chọn cả trục ngang (ghi chú ở
 * `region-gallery.tsx`). CHỈ gọi khi bấm phân trang; lọc/tìm cũng về trang 1
 * nhưng người dùng đang đứng ở bộ lọc, cuộn họ đi là giật.
 */
export const NAV_OFFSET = 128;

export function scrollToListTop(el: HTMLElement | null, offset: number = NAV_OFFSET): void {
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
