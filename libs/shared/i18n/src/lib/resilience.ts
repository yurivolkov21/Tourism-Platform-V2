// Tầng chống chịu (W2): copy cho loading/error/404 dùng ở web. Giọng ấm, trấn
// an. Để RIÊNG module này vì error.tsx/global-error.tsx là client component —
// import cả `messages.ts` (~83KB chuỗi) vào bundle client chỉ để lấy vài câu
// là phí. `messages.resilience` vẫn trỏ về đây nên chỗ gọi cũ không đổi.
export const resilience = {
  loadError: {
    title: 'We couldn’t load this',
    body: 'Something interrupted the connection. Please try again in a moment.',
    retry: 'Try again',
  },
  error: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred on our end. Please try again — if it keeps happening, get in touch.',
    retry: 'Try again',
    home: 'Back home',
  },
  notFound: {
    title: 'Page not found',
    body: 'The page you’re looking for doesn’t exist or may have moved. Let’s get you back on track.',
    home: 'Back home',
    tours: 'Browse tours',
    blog: 'Read the journal',
    /** Dòng mono nhỏ trên tiêu đề hero 404. */
    eyebrow: 'Error 404',
    /** Nhãn ảnh nền hero 404 (ImagePlaceholder). */
    imageLabel: '404 — Ha Long Bay panorama',
  },
  // Thân trang 404 dưới hero (not-found-body.tsx) — W-09 (14/10). Câu gợi ý có ba link
  // nhúng giữa câu nên cắt thành từng mảnh theo đúng thứ tự hiển thị; component ghép lại
  // kèm khoảng trắng `{' '}` trước mỗi link.
  notFoundBody: {
    eyebrow: 'No route found',
    titleLead: 'We lost this page,',
    titleAccent: 'not you.',
    lead: 'The link may be broken, or the page may have moved — nothing lives at this URL.',
    suggestStart: 'While you’re here, read the latest notes in',
    suggestJournal: 'the journal',
    suggestMeet: ', meet',
    suggestGuides: 'the guides behind the trips',
    suggestSkim: ', or skim the',
    suggestFaq: 'questions travellers ask most',
    suggestEnd: '.',
    home: 'Back to home',
  },
  globalError: {
    title: 'Something went wrong',
    body: 'The page failed to load. Please reload to try again.',
    retry: 'Reload',
  },
  checkoutError: {
    title: 'We’re confirming your payment',
    body: 'Your payment is safe. We hit a snag loading this page, but your booking isn’t lost — try again, or check your trips in a moment.',
    retry: 'Try again',
    account: 'View my trips',
  },
};
