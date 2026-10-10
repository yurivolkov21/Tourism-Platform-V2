import { Button, EmptyState, Screen, useTheme } from '@tourism/mobile-ui';
import { ActivityIndicator, View } from 'react-native';

export interface ReviewLoadStateProps {
  state: 'loading' | 'error';
  errorText: string;
  retryLabel: string;
  onRetry: () => void;
}

/**
 * Khung chờ/lỗi chung của R1, R4, R5, R6. Trước đây các route trả `null` (màn trắng,
 * không có đường ra) hoặc hiện "chưa có đánh giá nào" cả lúc đang tải lẫn lúc lỗi.
 */
export function ReviewLoadState({ state, errorText, retryLabel, onRetry }: ReviewLoadStateProps) {
  const theme = useTheme();

  return (
    <Screen edges={[]} padded={false} scrollable={false}>
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing(6) }}>
        {state === 'loading' ? (
          <ActivityIndicator testID="review-loading" color={theme.colors['primary-emphasis']} />
        ) : (
          <EmptyState
            icon={null}
            title={errorText}
            titleVariant="subtitle"
            titleTone="muted"
            surface={false}
          >
            <Button label={retryLabel} onPress={onRetry} shape="pill" />
          </EmptyState>
        )}
      </View>
    </Screen>
  );
}
