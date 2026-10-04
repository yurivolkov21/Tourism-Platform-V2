import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { messages } from '@tourism/i18n';
import {
  AppText,
  Button,
  FormMessage,
  Screen,
  TextField,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EditAvatarSheet } from '@/features/account/edit-avatar-sheet';
import { BookingTripCard } from '@/features/booking/booking-parts';
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, REVIEW_TITLE_MAX } from './review-form';
import type { ReviewPhotoItem } from './review-photos';

export type ReviewPhase = 'form' | 'submitted' | 'tooEarly' | 'alreadyReviewed';

export interface WriteReviewScreenProps {
  copy: typeof messages.reviews;
  phase: ReviewPhase;
  bookingCode: string;
  tourTitle: string;
  imageUrl: string | null;
  transformUrl?: (source: string, width: number) => string;
  dateRangeLabel: string;
  rating: number | null;
  onRatingChange: (rating: number) => void;
  title: string;
  onTitleChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  canSubmit: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: () => void;
  onBack: () => void;
  onSeeReviews: () => void;
  photos: readonly ReviewPhotoItem[];
  maxPhotos: number;
  photoError: string | null;
  sheetOpen: boolean;
  sheetBusy: boolean;
  sheetError: string | null;
  onOpenSheet: () => void;
  onCloseSheet: () => void;
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
  onRetryPhoto: (key: string) => void;
  onRemovePhoto: (key: string) => void;
  /** R5 (sửa bài bị bác): banner lý do người duyệt viết, đặt trên form. */
  rejection?: {
    title: string;
    reasonLabel: string;
    reason: string;
    body: string;
    footnote: string;
  };
  submitLabel?: string;
  submittingLabel?: string;
  /** R5 chưa có `bookingCode` trong `reviews.mine` nên chưa thêm ảnh mới được. */
  allowAddPhoto?: boolean;
}

const STAR_COUNT = 5;

/**
 * R1 — viết đánh giá (mockup `mobile-review-screens` mục 1), cùng màn R3 (đã gửi)
 * và hai ca chặn (chưa đi xong / đã viết rồi). Một màn cuộn, không chia bước.
 */
export function WriteReviewScreen({
  copy,
  phase,
  bookingCode,
  tourTitle,
  imageUrl,
  transformUrl,
  dateRangeLabel,
  rating,
  onRatingChange,
  title,
  onTitleChange,
  body,
  onBodyChange,
  canSubmit,
  submitting,
  errorMessage,
  onSubmit,
  onBack,
  onSeeReviews,
  photos,
  maxPhotos,
  photoError,
  sheetOpen,
  sheetBusy,
  sheetError,
  onOpenSheet,
  onCloseSheet,
  onTakePhoto,
  onChooseLibrary,
  onRetryPhoto,
  onRemovePhoto,
  rejection,
  submitLabel,
  submittingLabel,
  allowAddPhoto = true,
}: WriteReviewScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (phase !== 'form') {
    const notice =
      phase === 'submitted'
        ? { title: copy.successTitle, body: copy.successBody }
        : phase === 'tooEarly'
          ? { title: copy.tooEarlyTitle, body: copy.tooEarlyBody }
          : { title: copy.alreadyReviewedTitle, body: copy.alreadyReviewedBody };

    // Khuôn mockup R3: icon ô vuông + tiêu đề + mô tả + pill trạng thái, nút pill ở dưới.
    return (
      <Screen edges={[]} padded={false} scrollable={false}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: theme.spacing(5),
            gap: theme.spacing(4),
          }}
        >
          <View
            style={{
              width: theme.spacing(16),
              height: theme.spacing(16),
              borderRadius: theme.radius.base * 2,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather
              name={phase === 'submitted' ? 'check' : 'info'}
              size={28}
              color={theme.colors['primary-emphasis']}
            />
          </View>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            {notice.title}
          </AppText>
          <AppText variant="subtitle" tone="muted" style={{ textAlign: 'center' }}>
            {notice.body}
          </AppText>
          {phase === 'submitted' ? (
            <View
              style={{
                alignSelf: 'center',
                paddingHorizontal: theme.spacing(3),
                paddingVertical: theme.spacing(1),
                borderRadius: 999,
                backgroundColor: withAlpha(theme.colors.warning, 0.16),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
                <Feather name="clock" size={13} color={theme.colors.foreground} />
                <AppText
                  variant="caption"
                  style={{ color: theme.colors.foreground, fontFamily: theme.fonts.semibold }}
                >
                  {copy.pendingReview}
                </AppText>
              </View>
            </View>
          ) : null}
          {/* Mockup: nút `.btn.primary` rộng cố định 220px. */}
          <View style={{ width: theme.spacing(55), marginTop: theme.spacing(2) }}>
            <Button label={copy.backToTrip} onPress={onBack} shape="pill" />
          </View>
          {/* Link "See my reviews" (mockup R3) → màn R4. */}
          <Pressable accessibilityRole="link" onPress={onSeeReviews}>
            <AppText variant="caption" style={{ color: theme.colors['primary-emphasis'] }}>
              {copy.seeMyReviews}
            </AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={[]} padded={false} scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
          gap: theme.spacing(4),
        }}
        keyboardShouldPersistTaps="handled"
      >
        {rejection === undefined ? null : (
          <View
            style={{
              gap: theme.spacing(2),
              padding: theme.spacing(4),
              borderRadius: theme.radius.base * 3,
              backgroundColor: withAlpha(theme.colors['destructive-emphasis'], 0.12),
            }}
          >
            <AppText variant="label">{rejection.title}</AppText>
            <AppText variant="subtitle" tone="muted">
              {rejection.body}
            </AppText>
            <AppText variant="caption" tone="muted">
              {rejection.reasonLabel}
            </AppText>
            <AppText variant="subtitle">{rejection.reason}</AppText>
            <AppText variant="caption" tone="muted">
              {rejection.footnote}
            </AppText>
          </View>
        )}

        <BookingTripCard
          imageUrl={imageUrl}
          title={tourTitle}
          dateRangeLabel={[dateRangeLabel, bookingCode].filter((part) => part !== '').join(' · ')}
          transformUrl={transformUrl}
        />

        <View style={{ gap: theme.spacing(2) }}>
          <AppText variant="label">{copy.ratingLabel}</AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
            {Array.from({ length: STAR_COUNT }, (_, index) => {
              const value = index + 1;
              const filled = rating !== null && value <= rating;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={copy.ratingValueLabel(value)}
                  accessibilityState={{ selected: rating === value }}
                  hitSlop={theme.spacing(2)}
                  onPress={() => onRatingChange(value)}
                >
                  <Ionicons
                    name={filled ? 'star' : 'star-outline'}
                    size={32}
                    color={
                      filled ? theme.colors['primary-emphasis'] : theme.colors['muted-foreground']
                    }
                  />
                </Pressable>
              );
            })}
          </View>
          {rating === null ? null : (
            <AppText variant="caption" tone="muted">
              {copy.ratingValueLabel(rating)}
            </AppText>
          )}
        </View>

        <TextField
          label={copy.titleLabel}
          placeholder={copy.titlePlaceholder}
          alwaysShowLabel
          value={title}
          onChangeText={onTitleChange}
          maxLength={REVIEW_TITLE_MAX}
        />

        <View style={{ gap: theme.spacing(1) }}>
          <TextField
            label={copy.bodyLabel}
            placeholder={copy.bodyPlaceholder}
            alwaysShowLabel
            value={body}
            onChangeText={onBodyChange}
            multiline
            maxLength={REVIEW_BODY_MAX}
          />
          {/* Bộ đếm hiện từ đầu: sàn 10 mới là thứ khách hay vấp, không chỉ khi sắp tràn. */}
          <AppText variant="caption" tone="muted" style={{ textAlign: 'right' }}>
            {copy.bodyCounter(body.trim().length, REVIEW_BODY_MAX)}
          </AppText>
          {body.trim().length > 0 && body.trim().length < REVIEW_BODY_MIN ? (
            <AppText variant="caption" tone="muted">
              {copy.bodyTooShort(REVIEW_BODY_MIN)}
            </AppText>
          ) : null}
        </View>

        <View style={{ gap: theme.spacing(2) }}>
          <AppText variant="label">{copy.photos.counter(photos.length, maxPhotos)}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }}>
            {photos.map((photo) => (
              <View
                key={photo.key}
                style={{
                  width: theme.spacing(18),
                  height: theme.spacing(18),
                  borderRadius: theme.radius.base * 2,
                  overflow: 'hidden',
                }}
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={{
                    width: '100%',
                    height: '100%',
                    opacity: photo.status === 'done' ? 1 : 0.4,
                  }}
                  accessibilityIgnoresInvertColors
                />
                {photo.status === 'uploading' ? (
                  <View
                    style={{
                      position: 'absolute',
                      inset: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ActivityIndicator color={theme.colors['primary-emphasis']} />
                  </View>
                ) : null}
                {photo.status === 'error' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={copy.photos.retry}
                    onPress={() => onRetryPhoto(photo.key)}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather
                      name="refresh-cw"
                      size={20}
                      color={theme.colors['destructive-emphasis']}
                    />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.photos.removePhoto}
                  hitSlop={theme.spacing(2)}
                  onPress={() => onRemovePhoto(photo.key)}
                  style={{ position: 'absolute', top: 4, right: 4 }}
                >
                  <Feather name="x-circle" size={18} color={theme.colors.foreground} />
                </Pressable>
              </View>
            ))}
            {allowAddPhoto && photos.length < maxPhotos ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.photos.addPhoto}
                onPress={onOpenSheet}
                style={{
                  width: theme.spacing(18),
                  height: theme.spacing(18),
                  borderRadius: theme.radius.base * 2,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="plus" size={24} color={theme.colors.foreground} />
              </Pressable>
            ) : null}
          </View>
          {photoError === null ? null : <FormMessage tone="error">{photoError}</FormMessage>}
        </View>

        {errorMessage === null ? null : <FormMessage tone="error">{errorMessage}</FormMessage>}
      </ScrollView>

      {/* Thanh đáy ghim cạnh ScrollView (khuôn BookingBottomBar): nút Submit luôn thấy. */}
      <View
        style={{
          paddingHorizontal: theme.spacing(6),
          paddingTop: theme.spacing(4),
          paddingBottom: Math.max(insets.bottom, theme.spacing(6)),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        }}
      >
        <Button
          label={submitting ? (submittingLabel ?? copy.submitting) : (submitLabel ?? copy.submit)}
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
          shape="pill"
        />
      </View>

      <EditAvatarSheet
        visible={sheetOpen}
        onClose={onCloseSheet}
        title={copy.photos.addPhoto}
        takePhotoLabel={copy.photos.takePhoto}
        chooseLibraryLabel={copy.photos.chooseLibrary}
        removePhotoLabel={copy.photos.removePhoto}
        cancelLabel={copy.photos.cancel}
        showRemove={false}
        pending={sheetBusy}
        errorText={sheetError}
        onTakePhoto={onTakePhoto}
        onChooseLibrary={onChooseLibrary}
        onRemove={() => {}}
      />
    </Screen>
  );
}
