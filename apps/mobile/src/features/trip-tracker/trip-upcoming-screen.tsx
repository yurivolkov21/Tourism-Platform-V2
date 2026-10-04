import Feather from '@expo/vector-icons/Feather';
import { AppText, Button, type FeatherIconName, Screen, useTheme } from '@tourism/mobile-ui';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RowLink, SectionLabel, TripCountCard, TripMeter } from './trip-tracker-parts';

export interface TripMilestone {
  state: 'done' | 'now' | 'upcoming';
  icon: FeatherIconName;
  title: string;
  caption: string;
}

export interface PackingItemVM {
  text: string;
  checked: boolean;
}

export interface TripUpcomingScreenProps {
  countdownLabel: string;
  countdownValue: string;
  subtitle: string;
  progressPercent: number;
  bottomBarLabel: string;
  onBottomBarPress: () => void;
  /** Mặt P1 (còn > 3 ngày) — rail mốc + ba lối "Get ready". `undefined` ở mặt
   *  P2 (xem `imminent`, hai mặt loại trừ nhau — route chỉ truyền ĐÚNG một). */
  upcoming?: {
    bookedLabel: string;
    departureFooterLabel: string;
    milestones: TripMilestone[];
    getReadyLabel: string;
    whatToBringRow: { label: string; caption: string; onPress: () => void };
    itineraryRow: { label: string; caption: string; onPress: () => void };
    includedRow: { label: string; caption: string; onPress: () => void };
  };
  /** Mặt P2 (≤ 3 ngày) — chỗ gặp + checklist tương tác. */
  imminent?: {
    meetingNote: { title: string; body: string } | null;
    packingChecklistLabel: string;
    items: PackingItemVM[];
    onToggle: (text: string) => void;
    ticksNoteLabel: string;
  };
}

function MilestoneNode({ milestone, isLast }: { milestone: TripMilestone; isLast: boolean }) {
  const theme = useTheme();
  const { state, icon, title, caption } = milestone;

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
      <View style={{ width: 24, alignItems: 'center' }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 99,
            borderWidth: 2,
            borderColor: state === 'now' ? theme.colors['primary-emphasis'] : theme.colors.border,
            backgroundColor: state === 'done' ? theme.colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather
            name={icon}
            size={13}
            color={
              state === 'done'
                ? theme.colors['primary-foreground']
                : state === 'now'
                  ? theme.colors['primary-emphasis']
                  : theme.colors['muted-foreground']
            }
          />
        </View>
        {isLast ? null : (
          <View
            style={{
              flex: 1,
              width: 2,
              marginVertical: 2,
              backgroundColor: state === 'done' ? theme.colors.primary : theme.colors.border,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : theme.spacing(4) }}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {caption}
        </AppText>
      </View>
    </View>
  );
}

function PackingTick({ item, onToggle }: { item: PackingItemVM; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        gap: theme.spacing(3),
        alignItems: 'flex-start',
        paddingVertical: theme.spacing(2),
      }}
    >
      <Feather
        name={item.checked ? 'check-square' : 'square'}
        size={20}
        color={item.checked ? theme.colors['primary-emphasis'] : theme.colors['muted-foreground']}
        style={{ marginTop: 1 }}
      />
      <AppText
        variant="subtitle"
        tone={item.checked ? 'muted' : 'default'}
        style={item.checked ? { textDecorationLine: 'line-through' } : undefined}
      >
        {item.text}
      </AppText>
    </Pressable>
  );
}

/** P1 (còn nhiều ngày) + P2 (≤ 3 ngày, cùng màn đổi giọng) — mockup mục 4. */
export function TripUpcomingScreen({
  countdownLabel,
  countdownValue,
  subtitle,
  progressPercent,
  bottomBarLabel,
  onBottomBarPress,
  upcoming,
  imminent,
}: TripUpcomingScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Screen edges={[]} padded={false} scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
        }}
      >
        <TripCountCard>
          <SectionLabel>{countdownLabel}</SectionLabel>
          <AppText variant="display" style={{ marginTop: 2 }}>
            {countdownValue}
          </AppText>
          <AppText variant="subtitle" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
          <TripMeter percent={progressPercent} />
          {upcoming ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: theme.spacing(1.5),
              }}
            >
              <AppText variant="caption" tone="muted">
                {upcoming.bookedLabel}
              </AppText>
              <AppText variant="caption" tone="muted">
                {upcoming.departureFooterLabel}
              </AppText>
            </View>
          ) : null}
        </TripCountCard>

        {upcoming ? (
          <>
            <View style={{ marginTop: theme.spacing(4) }}>
              {upcoming.milestones.map((milestone, index) => (
                <MilestoneNode
                  key={milestone.title}
                  milestone={milestone}
                  isLast={index === upcoming.milestones.length - 1}
                />
              ))}
            </View>

            <View style={{ marginTop: theme.spacing(4) }}>
              <SectionLabel>{upcoming.getReadyLabel}</SectionLabel>
            </View>
            <RowLink
              icon="briefcase"
              label={upcoming.whatToBringRow.label}
              caption={upcoming.whatToBringRow.caption}
              onPress={upcoming.whatToBringRow.onPress}
            />
            <RowLink
              icon="map"
              label={upcoming.itineraryRow.label}
              caption={upcoming.itineraryRow.caption}
              onPress={upcoming.itineraryRow.onPress}
            />
            <RowLink
              icon="check-circle"
              label={upcoming.includedRow.label}
              caption={upcoming.includedRow.caption}
              onPress={upcoming.includedRow.onPress}
              last
            />
          </>
        ) : null}

        {imminent ? (
          <>
            {imminent.meetingNote === null ? null : (
              <View
                style={{
                  flexDirection: 'row',
                  gap: theme.spacing(2.5),
                  marginTop: theme.spacing(4),
                  padding: theme.spacing(3.5),
                  borderRadius: theme.radius.base * 2,
                  backgroundColor: theme.colors.secondary,
                }}
              >
                <Feather name="map-pin" size={20} color={theme.colors['secondary-foreground']} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label" style={{ color: theme.colors['secondary-foreground'] }}>
                    {imminent.meetingNote.title}
                  </AppText>
                  <AppText
                    variant="caption"
                    style={{
                      color: theme.colors['secondary-foreground'],
                      marginTop: 2,
                      opacity: 0.85,
                    }}
                  >
                    {imminent.meetingNote.body}
                  </AppText>
                </View>
              </View>
            )}

            <View style={{ marginTop: theme.spacing(5) }}>
              <SectionLabel>{imminent.packingChecklistLabel}</SectionLabel>
            </View>
            {imminent.items.map((item) => (
              <PackingTick
                key={item.text}
                item={item}
                onToggle={() => imminent.onToggle(item.text)}
              />
            ))}
            <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(2) }}>
              {imminent.ticksNoteLabel}
            </AppText>
          </>
        ) : null}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.spacing(6),
          paddingTop: theme.spacing(4),
          paddingBottom: Math.max(insets.bottom, theme.spacing(3)),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        }}
      >
        <Button shape="pill" variant="ghost" label={bottomBarLabel} onPress={onBottomBarPress} />
      </View>
    </Screen>
  );
}
