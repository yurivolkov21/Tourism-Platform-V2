import { MotionReplay } from '@tourism/mobile-ui';
import { useFocusEffect } from 'expo-router';
import { type ComponentType, useCallback, useRef, useState } from 'react';

/**
 * Số tăng lên MỖI LẦN tab được quay về (không tính lần mở đầu). Các tab dưới không bị dựng lại khi chuyển
 * tab, nên hiệu ứng "hiện dần" gắn lúc mount chỉ chạy một lần — token này cho chúng chạy lại mà không đụng
 * tới state của màn (vị trí cuộn, chữ đang tìm, bộ lọc).
 */
function useReplayToken(): number {
  const [token, setToken] = useState(0);
  const first = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      setToken((current) => current + 1);
    }, []),
  );

  return token;
}

/** Bọc route của một tab để các hiệu ứng vào màn (`FadeIn`, `PopIn`) chạy lại khi quay về tab. */
export function withReplayOnFocus(Screen: ComponentType): ComponentType {
  function WithReplayOnFocus() {
    const token = useReplayToken();
    return (
      <MotionReplay token={token}>
        <Screen />
      </MotionReplay>
    );
  }
  WithReplayOnFocus.displayName = `WithReplayOnFocus(${Screen.displayName ?? Screen.name})`;
  return WithReplayOnFocus;
}
