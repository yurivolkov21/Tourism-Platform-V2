import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { AppText } from './app-text';
import { Card } from './card';
import { useTheme } from './theme-provider';

export interface EmptyStateProps extends ViewProps {
  /** Icon vuông phía trên câu chính — dùng chung cho tri-state lỗi/rỗng (ADR-0047 §3). */
  icon?: ReactNode;
  /** Câu chính — tiếng Anh, lấy từ `@tourism/i18n` (luật 7). */
  title: string;
  /** Câu phụ giải thích hoặc gợi ý bước tiếp theo. */
  body?: string;
  /** Khe cho hành động đi kèm (thường là một `Button`). */
  children?: ReactNode;
}

/** Ô "chưa có gì ở đây" / "không tải được" — dùng chung cho danh sách rỗng, lỗi tải, và màn giữ chỗ. */
export function EmptyState({ icon, title, body, children, style, ...rest }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <Card style={[{ alignItems: 'center', gap: theme.spacing(2) }, style]} {...rest}>
      {icon}
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {body === undefined ? null : (
        <AppText tone="muted" style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      )}
      {children}
    </Card>
  );
}
