import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { AppText } from './app-text';
import { Card } from './card';
import { useTheme } from './theme-provider';

export interface EmptyStateProps extends ViewProps {
  /** Câu chính — tiếng Anh, lấy từ `@tourism/i18n` (luật 7). */
  title: string;
  /** Câu phụ giải thích hoặc gợi ý bước tiếp theo. */
  body?: string;
  /** Khe cho hành động đi kèm (thường là một `Button`). */
  children?: ReactNode;
}

/** Ô "chưa có gì ở đây" — dùng chung cho mọi danh sách rỗng và màn giữ chỗ. */
export function EmptyState({ title, body, children, style, ...rest }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <Card style={[{ alignItems: 'center', gap: theme.spacing(2) }, style]} {...rest}>
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
