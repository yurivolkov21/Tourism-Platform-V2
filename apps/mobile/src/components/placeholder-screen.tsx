import { messages } from '@tourism/i18n';
import { AppText, EmptyState, Screen } from '@tourism/mobile-ui';

// Thân màn dùng chung của TEMPLATE P5a. Mọi màn trong cây route đều là ô giữ
// chỗ này — P5b thay dần từng màn bằng nội dung thật, và mỗi lần thay chỉ đổi
// một file route chứ không đụng tới vỏ điều hướng.
export interface PlaceholderScreenProps {
  /** Tiêu đề màn, lấy từ `messages.mobile.appShell.titles` (luật 7). */
  title: string;
  /**
   * Tham số động của route (slug tour, mã booking) — in ra để cây route được
   * nghiệm thu cả phần tham số, không phải chữ user-facing nên không qua i18n.
   */
  detail?: string;
}

export function PlaceholderScreen({ title, detail }: PlaceholderScreenProps) {
  const { placeholder } = messages.mobile.appShell;

  return (
    <Screen>
      <AppText variant="title">{title}</AppText>
      {detail === undefined ? null : (
        <AppText tone="muted" variant="caption">
          {detail}
        </AppText>
      )}
      <EmptyState title={placeholder.title} body={placeholder.body} />
    </Screen>
  );
}
