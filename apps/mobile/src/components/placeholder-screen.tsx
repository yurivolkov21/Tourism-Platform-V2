import { messages } from '@tourism/i18n';
import { AppText, EmptyState, Screen, type ScreenEdge } from '@tourism/mobile-ui';

// Thân màn dùng chung của TEMPLATE P5a. Mọi màn trong cây route đều là ô giữ
// chỗ này — P5b thay dần từng màn bằng nội dung thật, và mỗi lần thay chỉ đổi
// một file route chứ không đụng tới vỏ điều hướng.
export interface PlaceholderScreenProps {
  /**
   * Tiêu đề in trong THÂN màn — chỉ truyền cho màn KHÔNG có header (5 tab, vì
   * `(tabs)/_layout` đặt `headerShown: false`). Màn có header thì tiêu đề đã do
   * navigator vẽ; in lại ở thân là hai dòng chữ y hệt chồng nhau, nặng nhất ở
   * `+not-found` nơi thành ba câu nói cùng một chuyện.
   */
  title?: string;
  /**
   * Tham số động của route (slug tour, mã booking) — in ra để cây route được
   * nghiệm thu cả phần tham số, không phải chữ user-facing nên không qua i18n.
   */
  detail?: string;
  /**
   * Cạnh vùng an toàn màn tự lo — PHẢI khớp khung của route (xem
   * `SCREEN_EDGES_UNDER_TABS` / `SCREEN_EDGES_UNDER_HEADER`). Không có mặc định
   * ở đây: ô giữ chỗ này dùng cho CẢ hai khung, đoán hộ là đoán sai một nửa.
   */
  edges: readonly ScreenEdge[];
}

export function PlaceholderScreen({ title, detail, edges }: PlaceholderScreenProps) {
  const { placeholder } = messages.mobile.appShell;

  return (
    <Screen edges={edges}>
      {title === undefined ? null : <AppText variant="title">{title}</AppText>}
      {detail === undefined ? null : (
        <AppText tone="muted" variant="caption">
          {detail}
        </AppText>
      )}
      <EmptyState title={placeholder.title} body={placeholder.body} />
    </Screen>
  );
}
