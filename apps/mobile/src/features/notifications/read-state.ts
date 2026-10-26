import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { loadReadIds, saveReadIds } from './read-store';

/**
 * Trạng thái "đã đọc" DÙNG CHUNG cho mọi nơi gọi (chuông ở Home và màn Notifications). Trước đây mỗi nơi giữ
 * một `useState` riêng: đọc ở màn Notifications thì chuông ở Home — vẫn mở phía dưới — còn giữ bản cũ nên số
 * chưa đọc không giảm. Kho nằm ở module, các hook đăng ký qua `useSyncExternalStore`.
 */
const EMPTY: ReadonlySet<string> = new Set();

interface Snapshot {
  userId: string | null;
  ids: ReadonlySet<string>;
}

let snapshot: Snapshot = { userId: null, ids: EMPTY };
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

/** Thêm `ids` vào tập đã đọc của `userId`; không có gì mới thì không phát tín hiệu và không ghi xuống kho. */
function addRead(userId: string, ids: readonly string[]) {
  if (snapshot.userId !== userId) return;
  const next = new Set(snapshot.ids);
  for (const id of ids) next.add(id);
  if (next.size === snapshot.ids.size) return;
  snapshot = { userId, ids: next };
  emit();
  void saveReadIds(userId, next);
}

/** Đặt lại kho — chỉ cho test (module giữ state qua các test trong một file). */
export function resetReadState() {
  snapshot = { userId: null, ids: EMPTY };
  emit();
}

export function useReadState(userId: string | null) {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (userId === null) {
      if (snapshot.userId !== null) {
        snapshot = { userId: null, ids: EMPTY };
        emit();
      }
      return;
    }
    // Đổi tài khoản: bỏ tập của người trước, tránh dính trạng thái đã đọc sang người sau.
    if (snapshot.userId !== userId) {
      snapshot = { userId, ids: EMPTY };
      emit();
    }
    let cancelled = false;
    void loadReadIds(userId).then((loaded) => {
      if (cancelled || snapshot.userId !== userId) return;
      // Hợp với những gì vừa đọc trong lúc kho đang tải, để lượt tải về muộn không ghi đè.
      const merged = new Set([...loaded, ...snapshot.ids]);
      if (merged.size === snapshot.ids.size) return;
      snapshot = { userId, ids: merged };
      emit();
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markRead = useCallback(
    (id: string) => {
      if (userId !== null) addRead(userId, [id]);
    },
    [userId],
  );

  const markAllRead = useCallback(
    (ids: readonly string[]) => {
      if (userId !== null) addRead(userId, ids);
    },
    [userId],
  );

  return {
    readIds: state.userId === userId ? state.ids : EMPTY,
    markRead,
    markAllRead,
  };
}
