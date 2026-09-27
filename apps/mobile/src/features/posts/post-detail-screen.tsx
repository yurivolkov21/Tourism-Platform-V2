import {
  AppImage,
  AppText,
  Button,
  Chip,
  EmptyState,
  IconButton,
  Screen,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MarkdownBlock } from './markdown';

export type PostDetailStatus = 'loading' | 'error' | 'content';

export interface RelatedTourVM {
  slug: string;
  title: string;
  imageUrl: string | null;
  /** "3 days · Challenging" đã ghép sẵn. */
  durationLabel: string;
  priceLabel: string;
}

export interface PostDetailScreenProps {
  status: PostDetailStatus;
  coverUrl: string | null;
  title: string;
  tagLabels: readonly string[];
  authorName: string | null;
  authorInitials: string;
  dateLabel: string;
  blocks: readonly MarkdownBlock[];
  relatedTours: readonly RelatedTourVM[];
  relatedToursTitle: string;
  readOnWebLabel: string;
  onReadOnWeb: () => void;
  onBack: () => void;
  backLabel: string;
  onTourPress: (slug: string) => void;
  errorTitle: string;
  retryLabel: string;
  onRetry: () => void;
  transformUrl?: (source: string, width: number) => string;
}

/**
 * Bài viết (G3/G4, spec P5b-4 §6) — ảnh bìa tràn mép, đọc một mạch từ trên
 * xuống, KHÔNG dùng khuôn hero-có-tab của trang tour. Header tự vẽ (glass,
 * cùng khuôn `TourDetailScreen`) — KHÔNG header native, vì nút back/mở-web
 * nằm ĐÈ lên ảnh bìa.
 *
 * MÀN CHỈ VẼ — fetch nằm ở route `app/posts/[slug].tsx`. `blocks` đã qua
 * `markdown.ts` (parse thuần, tách khỏi component để test).
 */
export function PostDetailScreen({
  status,
  coverUrl,
  title,
  tagLabels,
  authorName,
  authorInitials,
  dateLabel,
  blocks,
  relatedTours,
  relatedToursTitle,
  readOnWebLabel,
  onReadOnWeb,
  onBack,
  backLabel,
  onTourPress,
  errorTitle,
  retryLabel,
  onRetry,
  transformUrl,
}: PostDetailScreenProps) {
  const theme = useTheme();
  const coverWidth = useWindowDimensions().width;
  // `Screen edges={['bottom']}` cố ý bỏ top — ảnh bìa phải tràn tới mép trên
  // cùng. Nhưng nút back/mở-web ĐÈ lên ảnh vẫn phải tự cộng `insets.top`,
  // không thì dính thẳng status bar (phản hồi 27/09) — cùng khuôn
  // `TourDetailScreen`, KHÔNG dùng `theme.spacing(3)` trần.
  const insets = useSafeAreaInsets();

  if (status === 'error') {
    return (
      <Screen edges={['bottom']} scrollable={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState title={errorTitle} surface={false}>
            <Button label={retryLabel} onPress={onRetry} />
          </EmptyState>
        </View>
        <View
          style={{
            position: 'absolute',
            top: insets.top + theme.spacing(1.5),
            left: theme.spacing(3),
          }}
        >
          <IconButton icon="arrow-left" accessibilityLabel={backLabel} onPress={onBack} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} padded={false} scrollable={false}>
      {/* Dải chắn status bar + nút back/mở-web là SIBLING của ScrollView bên
          dưới, KHÔNG phải children của nó — `Screen scrollable` (mặc định)
          bọc children vào MỘT ScrollView, nên đặt overlay bên trong đó vẫn
          cuộn theo mất luôn (phản hồi 27/09, cuộn sâu là chữ trôi lên đè
          status bar, nút back cũng biến mất). Set `scrollable={false}` rồi
          tự dựng ScrollView riêng — overlay đứng NGOÀI, luôn cố định. */}
      <ScrollView>
        <View
          style={{
            width: '100%',
            height: theme.spacing(62),
            backgroundColor: theme.colors.muted,
          }}
        >
          {coverUrl === null ? null : (
            <AppImage
              source={coverUrl}
              width={coverWidth}
              alt={title}
              transformUrl={transformUrl}
              fill
            />
          )}
          <LinearGradient
            colors={[withAlpha(theme.colors.scrim, 0.3), withAlpha(theme.colors.scrim, 0)]}
            locations={[0, 0.4]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={{ paddingHorizontal: theme.spacing(6), paddingTop: theme.spacing(4) }}>
          {tagLabels.length === 0 ? null : (
            <View style={{ flexDirection: 'row', gap: theme.spacing(2), flexWrap: 'wrap' }}>
              {tagLabels.map((tag) => (
                <Chip key={tag} label={tag} />
              ))}
            </View>
          )}
          <AppText variant="title" style={{ marginTop: theme.spacing(3) }}>
            {title}
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing(2),
              marginTop: theme.spacing(2),
            }}
          >
            <View
              style={{
                width: theme.spacing(7),
                height: theme.spacing(7),
                borderRadius: theme.spacing(3.5),
                backgroundColor: theme.colors.secondary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText
                variant="caption"
                style={{
                  color: theme.colors['secondary-foreground'],
                  fontFamily: theme.fonts.semibold,
                }}
              >
                {authorInitials}
              </AppText>
            </View>
            {authorName === null ? null : (
              <AppText variant="caption" tone="muted">
                {authorName}
              </AppText>
            )}
            <View
              style={{
                width: 3,
                height: 3,
                borderRadius: 999,
                backgroundColor: theme.colors['muted-foreground'],
              }}
            />
            <AppText variant="caption" tone="muted">
              {dateLabel}
            </AppText>
          </View>

          <View style={{ marginTop: theme.spacing(4) }}>
            {blocks.map((block, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: `blocks` là kết quả parse THUẦN của một bài, cố định trong vòng đời màn, không sắp xếp lại.
              <MarkdownBlockView key={index} block={block} />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onReadOnWeb}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing(2),
              minHeight: 52,
              marginTop: theme.spacing(4),
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            <AppText variant="subtitle" tone="muted" style={{ flex: 1 }}>
              {readOnWebLabel}
            </AppText>
          </Pressable>

          {relatedTours.length === 0 ? null : (
            <View style={{ marginTop: theme.spacing(5) }}>
              <AppText variant="label" tone="muted">
                {relatedToursTitle}
              </AppText>
              <View style={{ marginTop: theme.spacing(2) }}>
                {relatedTours.map((tour) => (
                  <RelatedTourRow
                    key={tour.slug}
                    tour={tour}
                    onPress={() => onTourPress(tour.slug)}
                    transformUrl={transformUrl}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Dải chắn status bar CỐ ĐỊNH — sibling của ScrollView ở trên, không
          cuộn theo, luôn che đúng dải `insets.top`. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: theme.colors.background,
        }}
      />
      {/* Nút back/mở-web CỐ ĐỊNH cùng lý do — đọc bài vẫn cần lùi lại được
          bất kể đang cuộn tới đâu, KHÔNG chỉ hiện lúc còn thấy ảnh bìa. */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + theme.spacing(1.5),
          left: theme.spacing(3),
          right: theme.spacing(3),
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <IconButton
          icon="arrow-left"
          accessibilityLabel={backLabel}
          variant="glass"
          onPress={onBack}
        />
        <IconButton
          icon="external-link"
          accessibilityLabel={readOnWebLabel}
          variant="glass"
          onPress={onReadOnWeb}
        />
      </View>
    </Screen>
  );
}

function MarkdownBlockView({ block }: { block: MarkdownBlock }) {
  const theme = useTheme();

  if (block.type === 'heading') {
    return (
      <AppText variant="heading" style={{ marginTop: theme.spacing(4) }}>
        {block.text}
      </AppText>
    );
  }
  if (block.type === 'paragraph') {
    return (
      <AppText variant="body" style={{ marginTop: theme.spacing(3) }}>
        {block.text}
      </AppText>
    );
  }
  return (
    <View style={{ marginTop: theme.spacing(3), gap: theme.spacing(1.5) }}>
      {block.items.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cùng lý do khối trên — list cố định của một bài.
        <View key={index} style={{ flexDirection: 'row', gap: theme.spacing(2) }}>
          <AppText variant="body">•</AppText>
          <AppText variant="body" style={{ flex: 1 }}>
            {line}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function RelatedTourRow({
  tour,
  onPress,
  transformUrl,
}: {
  tour: RelatedTourVM;
  onPress: () => void;
  transformUrl?: (source: string, width: number) => string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(3),
        minHeight: 52,
        paddingVertical: theme.spacing(2),
      }}
    >
      <View
        style={{
          width: theme.spacing(16),
          height: theme.spacing(16),
          borderRadius: theme.radius.base * 2,
          overflow: 'hidden',
          backgroundColor: theme.colors.muted,
        }}
      >
        {tour.imageUrl === null ? null : (
          <AppImage
            source={tour.imageUrl}
            width={theme.spacing(16)}
            alt={tour.title}
            transformUrl={transformUrl}
            fill
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="label" numberOfLines={2}>
          {tour.title}
        </AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
          {tour.durationLabel}
        </AppText>
        <AppText variant="label" style={{ marginTop: 4 }}>
          {tour.priceLabel}
        </AppText>
      </View>
    </Pressable>
  );
}
