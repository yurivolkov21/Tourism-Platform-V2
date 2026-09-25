import {
  AppImage,
  AppText,
  IconButton,
  shouldDismissDrag,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { useRef, useState } from 'react';
import { Animated, Modal, ScrollView, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface TourDetailPhoto {
  /** URL đã chọn sẵn để hiển thị — `VIDEO` đã quy về `posterUrl` từ trước (route). */
  url: string;
  alt: string | null;
  /** Đã ghép sẵn ("Photo: Nguyễn Minh · CC BY-SA 4.0") — `null` = không vẽ dòng. */
  creditLine: string | null;
}

/**
 * Ghi công ảnh (ADR-0020, D5) — nối `author`/`license` bằng " · ", bỏ phần
 * nào null. Cả hai null → `null` (KHÔNG vẽ dòng ghi công, khớp bản vẽ).
 */
export function mediaCreditText(author: string | null, license: string | null): string | null {
  const parts = [author, license].filter((value): value is string => value !== null);
  return parts.length === 0 ? null : parts.join(' · ');
}

/**
 * URL hiển thị trong trình xem: ảnh thường dùng `url`; `VIDEO` chỉ hiện
 * `posterUrl` (chưa phát video ở đợt này) — `?? url` chỉ là lưới an toàn cho
 * dữ liệu thiếu `posterUrl` trái luật, không phải nhánh nghiệp vụ thật.
 */
export function photoDisplayUrl(media: {
  type: 'IMAGE' | 'VIDEO';
  url: string;
  posterUrl: string | null;
}): string {
  return media.type === 'VIDEO' ? (media.posterUrl ?? media.url) : media.url;
}

/**
 * Trang hiện tại từ vị trí cuộn ngang lúc `onMomentumScrollEnd` — làm tròn về
 * bội số gần nhất của `pageWidth` rồi kẹp trong khoảng hợp lệ, phòng quán
 * tính cuộn vượt quá trang cuối/trước trang đầu.
 */
export function pageIndexFromOffset(
  offsetX: number,
  pageWidth: number,
  totalPages: number,
): number {
  if (pageWidth <= 0 || totalPages <= 0) return 0;
  const raw = Math.round(offsetX / pageWidth);
  return Math.min(totalPages - 1, Math.max(0, raw));
}

/** Kẹp scale chụm-để-phóng-to trong [1, 4] — dưới 1 là thu nhỏ hơn ảnh gốc (vô nghĩa), trên 4 là phóng quá mức đọc được. */
export function clampZoomScale(scale: number): number {
  return Math.min(4, Math.max(1, scale));
}

export interface PhotoViewerProps {
  /** Không có prop `visible`: cha CHỈ mount component này lúc mở (cùng khuôn
      `compactHeaderVisible` ở `TourDetailScreen`) — đóng là gỡ hẳn khỏi cây,
      không toggle một instance sống mãi. `Modal` bên trong luôn `visible`. */
  onClose: () => void;
  closeLabel: string;
  /** "3 / 17" — nhận (số thứ tự 1-based, tổng), tự tính lại theo `index` đang
      cuộn TRONG component này, không phải chuỗi tĩnh cha truyền một lần. */
  counterFor: (index: number, total: number) => string;
  photos: readonly TourDetailPhoto[];
  initialIndex: number;
  transformUrl?: (source: string, width: number) => string;
}

/**
 * Trình xem ảnh toàn màn (D5, bản vẽ 18/09) — dùng chung cho ảnh tour (D1) và
 * ảnh review (D4), route truyền `photos` khác nhau tuỳ nguồn mở. Nền `scrim`
 * đặc, không nút tải ảnh (Navel có, bản vẽ bỏ).
 *
 * Chụm-để-phóng-to + vuốt-xuống-để-đóng dựng bằng `react-native-gesture-handler`
 * (ADR-0040 AMEND 3, 24/09) — bản dựng đầu cùng ngày từng bỏ hai gesture này vì
 * `PanResponder` lõi không đáng tin cho một bề mặt có NHIỀU gesture cạnh tranh
 * (vuốt ngang đổi ảnh, chụm hai ngón, vuốt dọc đóng); đúng bài toán
 * gesture-handler sinh ra để giải.
 *
 * KHÔNG dùng `react-native-reanimated` — thử ở lượt đầu (24/09) thì bản SDK 57
 * `npx expo install` chọn (4.5.1) đòi `react-native-worklets@0.10.x`, nhưng
 * cây phụ thuộc của chính `@expo/ui`/`expo-router` lại kéo `0.12.1`: HAI bản
 * `react-native-worklets` xung đột trong cùng cây, và reanimated tự chặn lúc
 * KHỞI TẠO (`assertWorkletsVersion`) — vỡ ở runtime thật, không phải lỗi giả
 * riêng Jest. Không đáng mạo hiểm gần freeze 15/10 cho một tính năng phụ.
 * `GestureDetector` của gesture-handler chạy được callback JS thuần (không
 * qua worklet) khi KHÔNG cấu hình reanimated — driving `Animated.Value` lõi
 * RN (đúng thứ `BottomSheet` đã dùng) vẫn cho pinch/pan/tap thật, chỉ mất
 * phần chạy trên UI thread của reanimated (không cần cho một trình xem ảnh).
 *
 * `GestureHandlerRootView` bọc RIÊNG ở đây (không chỉ ở gốc app): `Modal` của
 * RN dựng một root native TÁCH KHỎI cây app chính, root ở `app/_layout.tsx`
 * không với vào được bên trong.
 */
export function PhotoViewer({
  onClose,
  closeLabel,
  counterFor,
  photos,
  initialIndex,
  transformUrl = (src) => src,
}: PhotoViewerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: pageWidth } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  // Vuốt dọc để đóng CHỈ hoạt động khi ảnh đang xem chưa zoom — zoom rồi thì
  // vuốt dọc là để DI CHUYỂN ảnh phóng to, không phải đóng. `zoomed` sống ở
  // component cha (không phải per-page) vì chỉ MỘT trang hiện trên màn tại
  // một thời điểm (paging).
  const [zoomed, setZoomed] = useState(false);
  const dismissTranslateY = useRef(new Animated.Value(0)).current;

  const dismissGesture = Gesture.Pan()
    .enabled(!zoomed)
    // Chỉ nhận cử chỉ dọc rõ ràng — cùng ngưỡng `BottomSheet`. `failOffsetX`
    // nhường vuốt ngang lại cho `ScrollView` phân trang bên dưới thay vì
    // giành mất gesture của nó.
    .activeOffsetY([-10, 10])
    .failOffsetX([-15, 15])
    .onUpdate((e) => {
      if (e.translationY > 0) dismissTranslateY.setValue(e.translationY);
    })
    .onEnd((e) => {
      if (shouldDismissDrag(e.translationY, e.velocityY / 1000)) {
        onClose();
      } else {
        Animated.spring(dismissTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      }
    })
    // Không cài reanimated (xem doc comment component) nên KHÔNG có worklet —
    // khai rõ chạy trên JS thread, né cảnh báo "some callbacks are worklets
    // and some are not" của chính gesture-handler khi để mặc định tự đoán.
    .runOnJS(true);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: withAlpha(theme.colors.scrim, 1) }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: insets.top + theme.spacing(1.5),
              paddingHorizontal: theme.spacing(3),
            }}
          >
            <IconButton
              icon="x"
              accessibilityLabel={closeLabel}
              variant="glass"
              onPress={onClose}
            />
            <AppText variant="label" tone="media">
              {counterFor(index + 1, photos.length)}
            </AppText>
            {/* Đệm rộng bằng nút X — chữ đếm mới thật sự canh giữa (khuôn bản vẽ). */}
            <View style={{ width: theme.touchTargetMin }} />
          </View>

          <GestureDetector gesture={dismissGesture}>
            <Animated.View style={{ flex: 1, transform: [{ translateY: dismissTranslateY }] }}>
              <ScrollView
                testID="photo-viewer-scroll"
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: initialIndex * pageWidth, y: 0 }}
                onMomentumScrollEnd={(e) => {
                  setIndex(
                    pageIndexFromOffset(e.nativeEvent.contentOffset.x, pageWidth, photos.length),
                  );
                }}
                style={{ flex: 1 }}
              >
                {photos.map((photo) => (
                  <View
                    key={photo.url}
                    style={{ width: pageWidth, flex: 1, justifyContent: 'center' }}
                  >
                    <PhotoPage photo={photo} transformUrl={transformUrl} onZoomChange={setZoomed} />
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          </GestureDetector>

          <View
            style={{
              paddingHorizontal: theme.spacing(6),
              paddingBottom: insets.bottom + theme.spacing(6),
            }}
          >
            {photos[index]?.alt === null || photos[index]?.alt === undefined ? null : (
              <AppText variant="subtitle" tone="media" style={{ opacity: 0.9 }}>
                {photos[index].alt}
              </AppText>
            )}
            {photos[index]?.creditLine === null ||
            photos[index]?.creditLine === undefined ? null : (
              <AppText
                variant="caption"
                tone="media"
                style={{ opacity: 0.6, marginTop: theme.spacing(1) }}
              >
                {photos[index].creditLine}
              </AppText>
            )}
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

/**
 * Một trang ảnh — tự lo chụm-để-phóng-to + kéo khi đã phóng + double-tap để
 * zoom nhanh. Báo `onZoomChange` lên cha để cha BẬT/TẮT gesture đóng-bằng-vuốt
 * (zoom rồi thì vuốt dọc phải di chuyển ảnh, không phải đóng trình xem).
 *
 * `scaleRef`/`translateXRef`/`translateYRef`: giá trị SỐ THẬT song song với
 * `Animated.Value` — gesture-handler cho delta TÍCH LUỸ từ lúc bắt đầu cử chỉ
 * (`e.scale`/`e.translationX/Y`), nên cần biết điểm xuất phát của LƯỢT TRƯỚC
 * để cộng dồn đúng qua nhiều lượt chụm/kéo liên tiếp — `Animated.Value` không
 * đọc được đồng bộ, phải giữ song song bằng `useRef<number>`.
 *
 * SIMPLIFICATION có chủ ý: không kẹp biên khi kéo ảnh đã phóng (ảnh có thể
 * kéo ra ngoài khung hình) — kẹp biên đúng cần biết kích thước hiển thị thật
 * của ảnh (khác nhau theo tỉ lệ khung mỗi ảnh), phức tạp hơn đáng kể so với
 * lợi ích cho một trình xem ảnh du lịch. Buông tay là ảnh tự trả về giữa
 * (double-tap hoặc chụm nhỏ lại dưới 1×).
 */
function PhotoPage({
  photo,
  transformUrl,
  onZoomChange,
}: {
  photo: TourDetailPhoto;
  transformUrl: (source: string, width: number) => string;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const { width } = useWindowDimensions();
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(1);
  const savedScaleRef = useRef(1);
  const translateXRef = useRef(0);
  const translateYRef = useRef(0);
  const savedTranslateXRef = useRef(0);
  const savedTranslateYRef = useRef(0);

  function resetZoom() {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    scaleRef.current = 1;
    savedScaleRef.current = 1;
    translateXRef.current = 0;
    translateYRef.current = 0;
    savedTranslateXRef.current = 0;
    savedTranslateYRef.current = 0;
    onZoomChange(false);
  }

  function zoomTo(next: number) {
    scale.setValue(next);
    scaleRef.current = next;
    savedScaleRef.current = next;
    onZoomChange(next > 1);
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = clampZoomScale(savedScaleRef.current * e.scale);
      scale.setValue(next);
      scaleRef.current = next;
    })
    .onEnd(() => {
      savedScaleRef.current = scaleRef.current;
      if (scaleRef.current <= 1) resetZoom();
      else onZoomChange(true);
    })
    // Không cài reanimated — chạy JS thread, cùng lý do `dismissGesture` ở
    // `PhotoViewer`.
    .runOnJS(true);

  const panWhileZoomed = Gesture.Pan()
    .onUpdate((e) => {
      if (scaleRef.current <= 1) return;
      const nextX = savedTranslateXRef.current + e.translationX;
      const nextY = savedTranslateYRef.current + e.translationY;
      translateX.setValue(nextX);
      translateY.setValue(nextY);
      translateXRef.current = nextX;
      translateYRef.current = nextY;
    })
    .onEnd(() => {
      savedTranslateXRef.current = translateXRef.current;
      savedTranslateYRef.current = translateYRef.current;
    })
    .runOnJS(true);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scaleRef.current > 1) resetZoom();
      else zoomTo(2.5);
    })
    .runOnJS(true);

  const zoomGesture = Gesture.Simultaneous(pinch, panWhileZoomed, doubleTap);

  return (
    <GestureDetector gesture={zoomGesture}>
      <Animated.View style={{ flex: 1, transform: [{ translateX }, { translateY }, { scale }] }}>
        <AppImage
          source={photo.url}
          width={Math.round(width * 2)}
          alt={photo.alt ?? ''}
          transformUrl={transformUrl}
          fill
          // `AppImage` gán cứng `contentFit="cover"` cho mọi chỗ khác (thumb/hero)
          // — trình xem cần `"contain"` (ảnh nguyên vẹn, không cắt); `rest` của
          // `AppImage` spread SAU giá trị mặc định nên ghi đè được, không cần
          // nhân bản component.
          contentFit="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}
