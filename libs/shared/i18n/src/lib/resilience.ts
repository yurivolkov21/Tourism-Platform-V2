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
