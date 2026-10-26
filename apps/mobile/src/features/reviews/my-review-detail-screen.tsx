import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { messages } from '@tourism/i18n';
import {
  AppImage,
  AppText,
  Icon,
  ListGroup,
  ListRow,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { formatFullDate } from '@/features/tour-detail/departures';
import { PhotoViewer, type TourDetailPhoto } from '@/features/tour-detail/photo-viewer';
import type { MyReviewModerationState, MyReviewNextStep } from './my-reviews';
import { ReviewStatePill } from './review-state-pill';

export interface MyReviewDetailVM {
  moderationState: MyReviewModerationState;
  dateIso: string;
  rating: number;
  title: string | null;
  body: string;
  tourTitle: string | null;
  tourImageUrl: string | null;
  /** Lý do bác của người duyệt — chỉ có khi `rejected`. */
  moderationNote: string | null;
  photos: readonly TourDetailPhoto[];
}

export interface MyReviewDetailScreenProps {
  copy: typeof messages.reviews.mine;
  viewerCloseLabel: string;
  viewerCounterFor: (index: number, total: number) => string;
  review: MyReviewDetailVM;
  /** Việc tiếp theo với bài (R4): rút / sửa / giải thích — `none` thì không có hàng hành động. */
  nextStep: MyReviewNextStep;
  onRetract: () => void;
  onRewrite: () => void;
  onWhy: () => void;
  /** Bấm khối tour; vắng khi bài không gắn tour. */
  onOpenTour?: () => void;
  transformUrl?: (source: string, width: number) => string;
}

const PHOTO_SIZE = 96;

/**
 * Chi tiết một bài đánh giá của tôi — mở từ thẻ ở R4. Chỉ đọc: trạng thái, ngày, sao, tiêu đề,
 * nội dung, ảnh (bấm mở trình xem toàn màn), lý do bác nếu có, rồi các việc khách làm tiếp được
 * (rút / sửa / xem lý do) dưới dạng danh sách thẻ rời như phần còn lại của app.
 */
export function MyReviewDetailScreen({
  copy,
  viewerCloseLabel,
  viewerCounterFor,
  review,
  nextStep,
  onRetract,
  onRewrite,
  onWhy,
  onOpenTour,
  transformUrl,
}: MyReviewDetailScreenProps) {
  const theme = useTheme();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  return (
    <Screen
      edges={SCREEN_EDGES_UNDER_HEADER}
      padded={false}
      scrollable={false}
      style={{ backgroundColor: theme.surfaces.grouped }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.spacing(4), gap: theme.spacing(4) }}
      >
        {review.tourTitle === null ? null : (
          <Pressable
            accessibilityRole={onOpenTour === undefined ? undefined : 'button'}
            accessibilityLabel={review.tourTitle}
            disabled={onOpenTour === undefined}
            onPress={onOpenTour}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing(3),
              padding: theme.spacing(3),
              borderRadius: 20,
              backgroundColor: theme.colors.card,
            }}
          >
            {review.tourImageUrl === null ? null : (
              <View
                style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden' }}
                accessibilityElementsHidden
              >
                <AppImage
                  source={review.tourImageUrl}
                  width={64}
                  alt=""
                  transformUrl={transformUrl}
                  fill
                />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="label" numberOfLines={2}>
                {review.tourTitle}
              </AppText>
              {onOpenTour === undefined ? null : (
                <AppText variant="caption" tone="link">
                  {copy.viewTour}
                </AppText>
              )}
            </View>
            {onOpenTour === undefined ? null : (
              <Icon name="chevron-right" size={24} color={theme.colors['muted-foreground']} />
            )}
          </Pressable>
        )}

        <View
          style={{
            padding: theme.spacing(4),
            borderRadius: 20,
            backgroundColor: theme.colors.card,
            gap: theme.spacing(3),
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }}>
            <ReviewStatePill copy={copy} state={review.moderationState} />
            <AppText variant="caption" tone="muted">
              {formatFullDate(review.dateIso)}
            </AppText>
          </View>

          <View
            style={{ flexDirection: 'row', gap: 2 }}
            accessible
            accessibilityLabel={copy.ratingLabel(review.rating)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <MaterialCommunityIcons
                key={n}
                name="star"
                size={20}
                color={n <= review.rating ? theme.colors.rating : theme.colors['rating-muted']}
              />
            ))}
          </View>

          {review.title === null ? null : <AppText variant="heading">{review.title}</AppText>}
          <AppText variant="body">{review.body}</AppText>

          {review.photos.length === 0 ? null : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
              {review.photos.map((photo, index) => (
                <Pressable
                  key={photo.url}
                  accessibilityRole="button"
                  accessibilityLabel={photo.alt ?? undefined}
                  onPress={() => setViewerIndex(index)}
                  style={{
                    width: PHOTO_SIZE,
                    height: PHOTO_SIZE,
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <AppImage
                    source={photo.url}
                    width={PHOTO_SIZE}
                    alt={photo.alt ?? ''}
                    transformUrl={transformUrl}
                    fill
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {review.moderationNote === null || review.moderationState !== 'rejected' ? null : (
          <View
            style={{
              padding: theme.spacing(4),
              borderRadius: 20,
              backgroundColor: theme.colors.card,
              gap: theme.spacing(1),
            }}
          >
            <AppText variant="label" style={{ color: theme.colors['destructive-emphasis'] }}>
              {copy.whyHeading}
            </AppText>
            <AppText variant="subtitle">{review.moderationNote}</AppText>
          </View>
        )}

        {nextStep === 'none' ? null : (
          <ListGroup>
            {nextStep === 'retract' ? (
              <ListRow title={copy.retractAction} destructive onPress={onRetract} />
            ) : nextStep === 'rewrite' ? (
              <ListRow icon="edit" title={copy.seeWhy} onPress={onRewrite} />
            ) : (
              <ListRow icon="info" title={copy.seeWhyFinal} onPress={onWhy} />
            )}
          </ListGroup>
        )}
      </ScrollView>

      {viewerIndex === null ? null : (
        <PhotoViewer
          photos={review.photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          closeLabel={viewerCloseLabel}
          counterFor={viewerCounterFor}
          transformUrl={transformUrl}
        />
      )}
    </Screen>
  );
}
