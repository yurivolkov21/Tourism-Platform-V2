import Feather from '@expo/vector-icons/Feather';
import {
  AppImage,
  AppText,
  Button,
  Chip,
  EmptyState,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  SearchField,
  useTheme,
} from '@tourism/mobile-ui';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

export type PostsListStatus = 'loading' | 'error' | 'content';

export interface PostListItemVM {
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  /** "24 Jul 2026" đã format sẵn. */
  dateLabel: string;
  /** Tối đa hai tag — tác giả bỏ ở danh sách (spec §"Byline"). */
  tagLabels: readonly string[];
}

export interface PostsListScreenProps {
  status: PostsListStatus;
  searchValue: string;
  searchPlaceholder: string;
  clearSearchLabel: string;
  onChangeSearch: (value: string) => void;
  /** `null` = "All". */
  selectedTag: string | null;
  allTagLabel: string;
  tags: readonly { slug: string; name: string }[];
  onSelectTag: (slug: string | null) => void;
  items: readonly PostListItemVM[];
  onPostPress: (slug: string) => void;
  hasMore: boolean;
  loadMoreLabel: string;
  onLoadMore: () => void;
  errorTitle: string;
  retryLabel: string;
  onRetry: () => void;
  emptyTitle: string;
  emptySearchTitle: string;
  emptySearchBody: string;
  onClearSearch: () => void;
  transformUrl?: (source: string, width: number) => string;
}

/**
 * Travel stories (G1/G2, spec P5b-4 §6) — mở từ dòng "Travel stories" ở tab
 * Account, KHÔNG cần đăng nhập. Bài mới nhất (item đầu, TRANG 1) là thẻ lớn
 * có ảnh bìa; phần còn lại là hàng gọn — cùng khuôn Explore (SearchField +
 * hàng chip cuộn ngang) nhưng chip lọc MỘT tag (API nhận `tag` đơn, không mảng).
 *
 * MÀN CHỈ VẼ — fetch/debounce/phân trang nằm ở route `app/posts/index.tsx`.
 */
export function PostsListScreen({
  status,
  searchValue,
  searchPlaceholder,
  clearSearchLabel,
  onChangeSearch,
  selectedTag,
  allTagLabel,
  tags,
  onSelectTag,
  items,
  onPostPress,
  hasMore,
  loadMoreLabel,
  onLoadMore,
  errorTitle,
  retryLabel,
  onRetry,
  emptyTitle,
  emptySearchTitle,
  emptySearchBody,
  onClearSearch,
  transformUrl,
}: PostsListScreenProps) {
  const theme = useTheme();
  // Bề rộng thẻ lớn (G1) = màn − đệm hai bên — cùng khuôn `cardWidth` của
  // ExploreScreen/SavedScreen, cần SỐ THẬT cho `AppImage` dựng URL Cloudinary
  // đúng cỡ (không phải 0 — `fill` chỉ quyết định style hiển thị).
  const cardWidth = useWindowDimensions().width - theme.spacing(12);

  return (
    <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false} scrollable={false}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: theme.spacing(6),
            paddingTop: theme.spacing(3),
            gap: theme.spacing(3),
          }}
        >
          <SearchField
            value={searchValue}
            onChangeText={onChangeSearch}
            placeholder={searchPlaceholder}
            clearLabel={clearSearchLabel}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 0, height: theme.spacing(8) }}
            contentContainerStyle={{ gap: theme.spacing(2) }}
          >
            <Chip
              label={allTagLabel}
              variant={selectedTag === null ? 'selected' : 'default'}
              onPress={() => onSelectTag(null)}
            />
            {tags.map((tag) => (
              <Chip
                key={tag.slug}
                label={tag.name}
                variant={selectedTag === tag.slug ? 'selected' : 'default'}
                onPress={() => onSelectTag(tag.slug)}
              />
            ))}
          </ScrollView>
        </View>

        {status === 'error' ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: theme.spacing(6),
            }}
          >
            <EmptyState icon={<SquareIcon name="wifi-off" />} title={errorTitle} surface={false}>
              <Button label={retryLabel} onPress={onRetry} />
            </EmptyState>
          </View>
        ) : status === 'content' && items.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: theme.spacing(6),
            }}
          >
            {searchValue === '' ? (
              <EmptyState icon={<SquareIcon name="search" />} title={emptyTitle} surface={false} />
            ) : (
              <EmptyState
                icon={<SquareIcon name="search" />}
                title={emptySearchTitle}
                body={emptySearchBody}
                surface={false}
              >
                <Button label={clearSearchLabel} variant="ghost" onPress={onClearSearch} />
              </EmptyState>
            )}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.spacing(6),
              paddingTop: theme.spacing(4),
              paddingBottom: theme.spacing(8),
              gap: theme.spacing(4),
            }}
          >
            {items.map((item, index) =>
              index === 0 ? (
                <FeaturedPostCard
                  key={item.slug}
                  item={item}
                  onPress={() => onPostPress(item.slug)}
                  transformUrl={transformUrl}
                  coverWidth={cardWidth}
                />
              ) : (
                <CompactPostRow
                  key={item.slug}
                  item={item}
                  onPress={() => onPostPress(item.slug)}
                  transformUrl={transformUrl}
                />
              ),
            )}
            {hasMore ? (
              <View style={{ alignItems: 'center' }}>
                <Button shape="pill" variant="ghost" label={loadMoreLabel} onPress={onLoadMore} />
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

function FeaturedPostCard({
  item,
  onPress,
  transformUrl,
  coverWidth,
}: {
  item: PostListItemVM;
  onPress: () => void;
  transformUrl?: (source: string, width: number) => string;
  coverWidth: number;
}) {
  const theme = useTheme();
  // Thiếu ảnh bìa → tụt xuống hàng gọn (spec §"cover nullable") — KHÔNG chừa
  // chỗ trống cho ảnh.
  if (item.coverUrl === null) return <CompactPostRow item={item} onPress={onPress} />;

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <View
        style={{
          width: '100%',
          height: theme.spacing(45),
          borderRadius: theme.radius.base * 3,
          overflow: 'hidden',
          backgroundColor: theme.colors.muted,
        }}
      >
        <AppImage
          source={item.coverUrl}
          width={coverWidth}
          alt={item.title}
          transformUrl={transformUrl}
          fill
        />
      </View>
      <AppText variant="heading" style={{ marginTop: theme.spacing(3) }}>
        {item.title}
      </AppText>
      {item.excerpt === null ? null : (
        <AppText variant="subtitle" tone="muted" numberOfLines={2} style={{ marginTop: 4 }}>
          {item.excerpt}
        </AppText>
      )}
      <Byline
        dateLabel={item.dateLabel}
        tagLabels={item.tagLabels}
        style={{ marginTop: theme.spacing(2) }}
      />
    </Pressable>
  );
}

function CompactPostRow({
  item,
  onPress,
  transformUrl,
}: {
  item: PostListItemVM;
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
        {item.coverUrl === null ? null : (
          <AppImage
            source={item.coverUrl}
            width={theme.spacing(16)}
            alt={item.title}
            transformUrl={transformUrl}
            fill
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="label" numberOfLines={2}>
          {item.title}
        </AppText>
        <Byline dateLabel={item.dateLabel} tagLabels={item.tagLabels} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

function Byline({
  dateLabel,
  tagLabels,
  style,
}: {
  dateLabel: string;
  tagLabels: readonly string[];
  style?: { marginTop: number };
}) {
  const theme = useTheme();
  const parts = [dateLabel, ...tagLabels];

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) }, style]}>
      {/* `key={part}` (KHÔNG index) — ngày + tên tag trong một Byline không
          bao giờ trùng chữ nhau, content-key thật, không cần suppress lint. */}
      {parts.map((part, index) => (
        <View
          key={part}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) }}
        >
          {index > 0 ? (
            <View
              style={{
                width: 3,
                height: 3,
                borderRadius: 999,
                backgroundColor: theme.colors['muted-foreground'],
              }}
            />
          ) : null}
          <AppText variant="caption" tone="muted">
            {part}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Khung vuông bo + icon giữa cho tri-state lỗi/rỗng — cùng khuôn Explore/Saved. */
function SquareIcon({ name }: { name: 'wifi-off' | 'search' }) {
  const theme = useTheme();

  return (
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
      <Feather name={name} size={28} color={theme.colors['primary-emphasis']} />
    </View>
  );
}
