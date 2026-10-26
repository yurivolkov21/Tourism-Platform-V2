import { AppText, Collapsible, Icon, useTheme } from '@tourism/mobile-ui';
import { memo, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { TourDetailItineraryDay } from './tour-detail-screen';

interface DayRowProps {
  day: TourDetailItineraryDay;
  isLast: boolean;
  open: boolean;
  onToggle: (dayNumber: number) => void;
}

/**
 * Một ngày của lịch trình. `memo` để bấm mở/thu một ngày chỉ dựng lại đúng hai hàng đổi
 * `open`, không dựng lại cả danh sách (lịch trình nhiều ngày mới thấy giật).
 */
const DayRow = memo(function DayRow({ day, isLast, open, onToggle }: DayRowProps) {
  const theme = useTheme();

  return (
    <View key={day.dayNumber} style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
      <View style={{ width: 24, alignItems: 'center' }}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 99,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: open ? theme.colors.primary : theme.colors.secondary,
          }}
        >
          <AppText
            variant="caption"
            style={{
              color: open ? theme.colors['primary-foreground'] : theme.colors['primary-emphasis'],
              fontWeight: theme.weight.semibold,
            }}
          >
            {day.dayNumber}
          </AppText>
        </View>
        {isLast ? null : (
          <View
            style={{
              flex: 1,
              width: 2,
              backgroundColor: theme.colors.border,
              marginTop: 4,
            }}
          />
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => onToggle(day.dayNumber)}
        style={{ flex: 1, paddingBottom: theme.spacing(1.5) }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <AppText variant="label" style={{ flex: 1 }}>
            {day.title}
          </AppText>
          <Icon
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.colors['muted-foreground']}
          />
        </View>
        {day.lines.length === 0 ? null : (
          <Collapsible open={open}>
            <View style={{ marginTop: theme.spacing(2), gap: 6 }}>
              {day.lines.map((line) =>
                line.kind === 'timed' ? (
                  <View
                    key={`${line.time}-${line.text}`}
                    style={{ flexDirection: 'row', gap: theme.spacing(2) }}
                  >
                    <AppText
                      variant="caption"
                      style={{ width: 44, fontWeight: theme.weight.semibold }}
                    >
                      {line.time}
                    </AppText>
                    <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
                      {line.text}
                    </AppText>
                  </View>
                ) : (
                  <AppText key={line.text} variant="caption" tone="muted">
                    {line.text}
                  </AppText>
                ),
              )}
            </View>
          </Collapsible>
        )}
      </Pressable>
    </View>
  );
});

/**
 * Danh sách ngày kiểu accordion. State mở/thu nằm Ở ĐÂY chứ không ở màn chi tiết, để bấm một
 * ngày không dựng lại cả màn.
 */
export function ItineraryDays({ days }: { days: readonly TourDetailItineraryDay[] }) {
  // Ngày đầu mở sẵn (D2) — `null` gấp lại HẾT (bấm ngày đang mở để thu gọn).
  // `undefined` = người dùng CHƯA bấm gì: suy ra ngày đầu ở mỗi lần render thay
  // vì chụp một lần lúc mount — lịch trình về sau lần render đầu (cache rỗng,
  // refetch) vẫn mở sẵn ngày đầu (F11). Đã bấm thì giữ lựa chọn, kể cả `null`.
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const expanded = picked === undefined ? (days[0]?.dayNumber ?? null) : picked;
  const toggle = useCallback(
    (dayNumber: number) => setPicked(expanded === dayNumber ? null : dayNumber),
    [expanded],
  );

  return (
    <>
      {days.map((day, index) => (
        <DayRow
          key={day.dayNumber}
          day={day}
          isLast={index === days.length - 1}
          open={day.dayNumber === expanded}
          onToggle={toggle}
        />
      ))}
    </>
  );
}
