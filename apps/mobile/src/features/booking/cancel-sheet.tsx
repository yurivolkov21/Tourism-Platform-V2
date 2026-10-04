import {
  AppText,
  BottomSheet,
  Button,
  FormMessage,
  TextField,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { Pressable, View } from 'react-native';

export interface CancelBookingSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  /** Vắng CẢ HAI (huỷ booking PENDING — `cancelPending`, không dính luật hoàn
   *  tiền) thì không vẽ khối số tiền. Đã định dạng ("$1,377" hoặc "$0") —
   *  server tính, màn chỉ in (ADR-0041 §7). */
  refundLabel?: string;
  refundAmount?: string;
  /** `.note.good` (còn hạn, có hoàn tiền — nền success pha loãng, chữ màu
   *  chính) hay `.note.info` (quá hạn, hoàn $0 — nền `secondary`, chữ
   *  `secondary-foreground`) của mockup. Mặc định `'good'` vì ca có hoàn tiền
   *  phổ biến hơn trong props tối thiểu; route luôn truyền tường minh. */
  refundTone?: 'good' | 'info';
  /** Nhãn nổi khi ô đã có chữ — mockup tách khỏi `reasonPlaceholder` (câu dài
   *  hơn, chỉ hiện lúc ô rỗng). */
  reasonLabel?: string;
  /** Vắng cả bốn (huỷ PENDING — lý do không còn gì để quyết, chỉ là một câu
   *  hỏi có/không, khuôn `cancelConfirmBody` bên web) thì không vẽ ô lý do. */
  reasonPlaceholder?: string;
  reason?: string;
  onChangeReason?: (value: string) => void;
  /** Chỉ hiện khi quá hạn (`within === false`) — lối sang form hỏi đáp (E1). */
  contactLine?: { prompt: string; onPress: () => void };
  confirmLabel: string;
  dismissLabel: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
}

/**
 * Tấm xác nhận huỷ booking đã trả (T6 trong hạn / T7 quá hạn, W5) — MỘT
 * component cho cả hai dạng, route quyết nội dung qua props (khuôn
 * `CancelBookingDialog` bên web: component chỉ vẽ, không tự so hạn chót).
 * Nút xác nhận luôn tông `destructive` (mockup: "không đổi màu cả màn, chỉ
 * nút huỷ mang tông destructive").
 */
export function CancelBookingSheet({
  visible,
  onClose,
  title,
  body,
  refundLabel,
  refundAmount,
  refundTone = 'good',
  reasonLabel,
  reasonPlaceholder,
  reason,
  onChangeReason,
  contactLine,
  confirmLabel,
  dismissLabel,
  pending,
  error,
  onConfirm,
}: CancelBookingSheetProps) {
  const theme = useTheme();
  const refundTextColor =
    refundTone === 'good' ? theme.colors.foreground : theme.colors['secondary-foreground'];

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Đệm thêm phía trên tiêu đề — tay nắm kéo của `BottomSheet` là
       *  `position:'absolute'` cao spacing(8)=32dp đè lên đầu nội dung; lần
       *  trước spacing(2) vẫn còn nằm trong vùng đó nên nhìn dính sát
       *  (phản hồi 01/10, ảnh soi tay nắm chạm chữ). */}
      <View style={{ marginTop: theme.spacing(6) }}>
        <AppText variant="heading">{title}</AppText>
      </View>
      <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing(3.5) }}>
        {body}
      </AppText>

      {refundLabel === undefined || refundAmount === undefined ? null : (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: theme.spacing(5),
            paddingVertical: theme.spacing(3),
            paddingHorizontal: theme.spacing(3.5),
            borderRadius: theme.radius.base * 2,
            backgroundColor:
              refundTone === 'good'
                ? withAlpha(theme.colors.success, 0.14)
                : theme.colors.secondary,
          }}
        >
          <AppText variant="label" style={{ color: refundTextColor }}>
            {refundLabel}
          </AppText>
          <AppText variant="title" style={{ color: refundTextColor }}>
            {refundAmount}
          </AppText>
        </View>
      )}

      {reasonLabel === undefined ||
      reasonPlaceholder === undefined ||
      onChangeReason === undefined ? null : (
        <View style={{ marginTop: theme.spacing(5) }}>
          <TextField
            label={reasonLabel}
            placeholder={reasonPlaceholder}
            alwaysShowLabel
            icon="message-square"
            // mockup `.field .ico`: khung vuông nền `secondary`, KHÔNG phải
            // icon trần (phản hồi 01/10, icon nhìn "lạc lõng" không khung).
            iconVariant="boxed"
            value={reason ?? ''}
            onChangeText={onChangeReason}
            multiline
          />
        </View>
      )}

      {contactLine === undefined ? null : (
        <Pressable onPress={contactLine.onPress} style={{ marginTop: theme.spacing(4) }}>
          <AppText variant="subtitle" tone="link">
            {contactLine.prompt}
          </AppText>
        </Pressable>
      )}

      {error === null ? null : (
        <View style={{ marginTop: theme.spacing(5) }}>
          <FormMessage tone="error">{error}</FormMessage>
        </View>
      )}

      <View style={{ marginTop: theme.spacing(8), gap: theme.spacing(3.5) }}>
        <Button
          shape="pill"
          variant="destructive"
          label={confirmLabel}
          disabled={pending}
          onPress={onConfirm}
        />
        <Button
          shape="pill"
          variant="ghost"
          label={dismissLabel}
          disabled={pending}
          onPress={onClose}
        />
      </View>
    </BottomSheet>
  );
}
