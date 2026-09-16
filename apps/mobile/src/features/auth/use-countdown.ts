import { useCallback, useEffect, useRef, useState } from 'react';

export interface Countdown {
  /** Số giây còn lại; chạm 0 là dừng hẳn. */
  remaining: number;
  /** Đếm lại từ mốc đầu — dùng sau khi gửi lại mã. */
  restart: () => void;
}

/**
 * Đếm ngược theo giây cho nút "Resend code".
 *
 * Dependency của effect là CỜ `running` chứ không phải chính `remaining`: lấy
 * `remaining` thì mỗi giây là một lần dọn rồi hẹn lại nhịp mới, và nhịp cứ lùi
 * dần theo thời gian React render. Với cờ, nhịp dựng đúng một lần và chỉ bị dọn
 * khi chạm 0 — lúc đó không còn hẹn giờ nào chạy không công.
 */
export function useCountdown(seconds: number): Countdown {
  const [remaining, setRemaining] = useState(seconds);
  // Mốc đầu giữ trong ref để `restart` không phải nằm trong dependency của
  // effect — đổi `seconds` giữa chừng không phải chuyện màn này cần.
  const startFrom = useRef(seconds);
  const running = remaining > 0;

  useEffect(() => {
    if (!running) return;

    const timer = setInterval(() => {
      setRemaining((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [running]);

  const restart = useCallback(() => setRemaining(startFrom.current), []);

  return { remaining, restart };
}

/**
 * `0:42`, `1:05` — phút:giây, giây luôn hai chữ số. Đứng ở đây (cạnh hook) chứ
 * không trong màn: đây là cách ĐỌC cùng một con số, hai màn dùng lại được.
 */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.trunc(totalSeconds));

  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
