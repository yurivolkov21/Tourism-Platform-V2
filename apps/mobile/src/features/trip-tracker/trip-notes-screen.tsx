import Feather from '@expo/vector-icons/Feather';
import { AppText, Screen, useTheme } from '@tourism/mobile-ui';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { visibleIncluded } from './trip-tracker';
import { SectionLabel, StaticTick } from './trip-tracker-parts';

export interface TripFaqVM {
  question: string;
  answer: string;
}

export interface TripNotesScreenProps {
  whatToBringLabel: string;
  whatToBringLines: readonly string[];
  includedInYourFareLabel: string;
  /** Danh sách ĐẦY ĐỦ — màn tự cắt 3 dòng + "Show all {n}" (`visibleIncluded`),
   *  việc mở xổ hết là UI thuần, không phải quyết định của route. */
  included: readonly string[];
  showAllLabel: (n: number) => string;
  notIncludedLabel: string;
  excluded: readonly string[];
  goodToKnowLabel: string;
  goodToKnowCaption: string;
  faqs: readonly TripFaqVM[];
}

/**
 * P3 — "Before you go", bản đầy đủ (mockup mục 4). "Good to know" mở XỔ
 * NGAY TRONG màn (không điều hướng đi đâu): mobile chưa có màn FAQ riêng ở
 * nhánh nào (chỉ web có) — dựng điều hướng tới một màn không tồn tại là nói
 * dối, xổ tại chỗ vẫn đọc được đúng dữ liệu `faqs[]` của tour.
 */
export function TripNotesScreen({
  whatToBringLabel,
  whatToBringLines,
  includedInYourFareLabel,
  included,
  showAllLabel,
  notIncludedLabel,
  excluded,
  goodToKnowLabel,
  goodToKnowCaption,
  faqs,
}: TripNotesScreenProps) {
  const theme = useTheme();
  const [showAllIncluded, setShowAllIncluded] = useState(false);
  const [faqsOpen, setFaqsOpen] = useState(false);
  const { visible, hiddenCount } = visibleIncluded(included);

  return (
    <Screen edges={[]} padded={false}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
        }}
      >
        <SectionLabel>{whatToBringLabel}</SectionLabel>
        {whatToBringLines.map((line) => (
          <StaticTick key={line} text={line} />
        ))}

        <View style={{ marginTop: theme.spacing(5) }}>
          <SectionLabel>{includedInYourFareLabel}</SectionLabel>
        </View>
        {(showAllIncluded ? included : visible).map((line) => (
          <StaticTick key={line} text={line} />
        ))}
        {!showAllIncluded && hiddenCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setShowAllIncluded(true)}>
            <AppText variant="caption" tone="link" style={{ marginTop: theme.spacing(1) }}>
              {showAllLabel(included.length)}
            </AppText>
          </Pressable>
        ) : null}

        <View style={{ marginTop: theme.spacing(5) }}>
          <SectionLabel>{notIncludedLabel}</SectionLabel>
        </View>
        {excluded.map((line) => (
          <StaticTick key={line} text={line} tone="excluded" />
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: faqsOpen }}
          onPress={() => setFaqsOpen((open) => !open)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(3),
            paddingVertical: theme.spacing(3),
            marginTop: theme.spacing(4),
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <View
            style={{
              width: theme.spacing(10),
              height: theme.spacing(10),
              borderRadius: theme.radius.base * 2,
              backgroundColor: theme.colors.secondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="message-square" size={20} color={theme.colors['primary-emphasis']} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText variant="label">{goodToKnowLabel}</AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {goodToKnowCaption}
            </AppText>
          </View>
          <Feather
            name={faqsOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.colors['muted-foreground']}
          />
        </Pressable>

        {faqsOpen
          ? faqs.map((faq) => (
              <View key={faq.question} style={{ marginTop: theme.spacing(3) }}>
                <AppText variant="label">{faq.question}</AppText>
                <AppText variant="subtitle" tone="muted" style={{ marginTop: 2 }}>
                  {faq.answer}
                </AppText>
              </View>
            ))
          : null}
      </ScrollView>
    </Screen>
  );
}
