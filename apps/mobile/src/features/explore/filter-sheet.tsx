import type { TourCard } from '@tourism/contract';
import { AppText, BottomSheet, Button, Chip, useTheme } from '@tourism/mobile-ui';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import type { DurationBucket, PriceBucket, TourFilterState } from './tour-filters';

/** Bốn kiểu web đang dùng (`toursPage.sortOptions`) — API đỡ đủ, sort chạy SERVER. */
export type SortKey = 'newest' | 'priceAsc' | 'priceDesc' | 'durationAsc';

interface LabeledOption<K extends string> {
  key: K;
  label: string;
}

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  regionOptions: readonly LabeledOption<string>[];
  durationOptions: readonly LabeledOption<DurationBucket>[];
  priceOptions: readonly LabeledOption<PriceBucket>[];
  difficultyOptions: readonly LabeledOption<NonNullable<TourCard['difficulty']>>[];
  sortOptions: readonly LabeledOption<SortKey>[];
  filters: TourFilterState;
  onChangeFilters: (next: TourFilterState) => void;
  sort: SortKey;
  onChangeSort: (next: SortKey) => void;
  /** Số kết quả SẼ RA với bộ lọc đang chọn — tính ở route, hiện trên nút chính. */
  resultCount: number;
  onClearAll: () => void;
  labels: {
    title: string;
    clearAll: string;
    regionTitle: string;
    durationTitle: string;
    priceTitle: string;
    difficultyTitle: string;
    sortTitle: string;
    allRegions: string;
    showResults: (n: number) => string;
  };
}

/**
 * Tấm lọc Explore (`.sheet` bản vẽ 18/09, E3 — ADR-0047 T2). Bốn facet
 * region/duration/price/difficulty là chip ĐƠN CHỌN (bấm lại chip đang chọn
 * thì gỡ về "không lọc") — khác sidebar checkbox đa chọn của web, vì bản vẽ
 * chỉ hiện MỘT chip "on" mỗi hàng. Sort luôn đúng một lựa chọn, không gỡ được.
 * Bộ lọc áp dụng TỨC THÌ (route đã lọc ngay khi state đổi) — nút chính chỉ
 * đóng tấm, không phải "Apply".
 */
export function FilterSheet({
  visible,
  onClose,
  regionOptions,
  durationOptions,
  priceOptions,
  difficultyOptions,
  sortOptions,
  filters,
  onChangeFilters,
  sort,
  onChangeSort,
  resultCount,
  onClearAll,
  labels,
}: FilterSheetProps) {
  const theme = useTheme();

  const toggleFacet = <K extends string>(facet: keyof TourFilterState, key: K) => {
    const current = filters[facet] as readonly K[];
    const next = current.includes(key) ? [] : [key];
    onChangeFilters({ ...filters, [facet]: next });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="heading">{labels.title}</AppText>
        <AppText variant="label" tone="link" accessibilityRole="button" onPress={onClearAll}>
          {labels.clearAll}
        </AppText>
      </View>
      <ScrollView style={{ maxHeight: theme.spacing(120) }} showsVerticalScrollIndicator={false}>
        {/* Nhịp dọc căn theo bản vẽ E3: hàng facet sát nhau hơn (gap 16dp),
            header cách nhóm đầu rộng hơn (20dp) để tách tiêu đề khỏi bộ lọc. */}
        <View style={{ gap: theme.spacing(4), paddingTop: theme.spacing(5) }}>
          <FacetRow title={labels.regionTitle}>
            <Chip
              label={labels.allRegions}
              variant={filters.regions.length === 0 ? 'selected' : 'default'}
              onPress={() => onChangeFilters({ ...filters, regions: [] })}
            />
            {regionOptions.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                variant={filters.regions.includes(option.key) ? 'selected' : 'default'}
                onPress={() => toggleFacet('regions', option.key)}
              />
            ))}
          </FacetRow>

          <FacetRow title={labels.durationTitle}>
            {durationOptions.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                variant={filters.durations.includes(option.key) ? 'selected' : 'default'}
                onPress={() => toggleFacet('durations', option.key)}
              />
            ))}
          </FacetRow>

          <FacetRow title={labels.priceTitle}>
            {priceOptions.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                variant={filters.prices.includes(option.key) ? 'selected' : 'default'}
                onPress={() => toggleFacet('prices', option.key)}
              />
            ))}
          </FacetRow>

          <FacetRow title={labels.difficultyTitle}>
            {difficultyOptions.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                variant={filters.difficulties.includes(option.key) ? 'selected' : 'default'}
                onPress={() => toggleFacet('difficulties', option.key)}
              />
            ))}
          </FacetRow>

          <FacetRow title={labels.sortTitle}>
            {sortOptions.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                variant={sort === option.key ? 'selected' : 'default'}
                onPress={() => onChangeSort(option.key)}
              />
            ))}
          </FacetRow>
        </View>
      </ScrollView>
      {/* CTA tách khỏi hàng Sort rộng hơn (24dp) và bo viên như `.btn` bản vẽ. */}
      <View style={{ paddingTop: theme.spacing(6) }}>
        <Button label={labels.showResults(resultCount)} onPress={onClose} shape="pill" />
      </View>
    </BottomSheet>
  );
}

function FacetRow({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View>
      <AppText variant="caption" tone="muted">
        {title}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing(2),
          marginTop: theme.spacing(2),
        }}
      >
        {children}
      </View>
    </View>
  );
}
