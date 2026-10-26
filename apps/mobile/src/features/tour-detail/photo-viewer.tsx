import {
  AppImage,
  AppText,
  IconButton,
  shouldDismissDrag,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
  'worklet';
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
 * Cử chỉ chạy trên luồng UI bằng `react-native-reanimated` (4.5.1 + `react-native-worklets`
 * 0.10.1, đúng bản Expo SDK 57 gắn với Expo Go): kéo/chụm theo ngón tay không qua luồng JS nên
 * không rớt khung. Hai bản worklets từng xung đột trong cây phụ thuộc (24/09) đã được gom về một
 * bản khi cài lại Reanimated; đừng nâng riêng một trong hai gói.
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
  const dismissTranslateY = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);

  const dismissGesture = Gesture.Pan()
    .enabled(!zoomed)
    // Chỉ nhận cử chỉ dọc rõ ràng — cùng ngưỡng `BottomSheet`. `failOffsetX`
    // nhường vuốt ngang lại cho `ScrollView` phân trang bên dưới thay vì
    // giành mất gesture của nó.
    .activeOffsetY([-10, 10])
    .failOffsetX([-15, 15])
    .onUpdate((e) => {
      if (e.translationY > 0) dismissTranslateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (shouldDismissDrag(e.translationY, e.velocityY / 1000)) {
        runOnJS(onClose)();
      } else {
        dismissTranslateY.value = withSpring(0, { stiffness: 220, damping: 20 });
      }
    });

  // Nền tối mờ dần theo ngón kéo xuống, ảnh trượt theo — cả hai tính trên luồng UI.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissTranslateY.value, [0, 320], [1, 0.2]),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dismissTranslateY.value }],
  }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* F2 (review 06/10): root PHẢI là con trực tiếp của `Modal` — bọc ở
          ngoài thì nó nằm ở cây app chính, Android không nhận pinch/double-tap/
          vuốt-đóng bên trong. Jest mock không phân biệt được, chỉ máy thật thấy. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Nền tối tách riêng để mờ dần theo ngón kéo xuống — kéo càng xa càng thấy trang phía sau. */}
        <Reanimated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(theme.colors.scrim, 1) },
            backdropStyle,
          ]}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: insets.top + theme.spacing(1.5),
            paddingHorizontal: theme.spacing(3),
          }}
        >
          <IconButton icon="x" accessibilityLabel={closeLabel} variant="glass" onPress={onClose} />
          <AppText variant="label" tone="media">
            {counterFor(index + 1, photos.length)}
          </AppText>
          {/* Đệm rộng bằng nút X — chữ đếm mới thật sự canh giữa (khuôn bản vẽ). */}
          <View style={{ width: theme.touchTargetMin }} />
        </View>

        <GestureDetector gesture={dismissGesture}>
          <Reanimated.View style={[{ flex: 1 }, sheetStyle]}>
            <ScrollView
              testID="photo-viewer-scroll"
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              ref={scrollRef}
              // `contentOffset` chỉ có tác dụng trên iOS — Android luôn mở ở ảnh đầu dù bộ
              // đếm báo ảnh khác. Cuộn tường minh tới ảnh được chọn ngay khi đo xong khung.
              contentOffset={{ x: initialIndex * pageWidth, y: 0 }}
              onLayout={() =>
                scrollRef.current?.scrollTo({ x: initialIndex * pageWidth, y: 0, animated: false })
              }
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
          </Reanimated.View>
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
          {photos[index]?.creditLine === null || photos[index]?.creditLine === undefined ? null : (
            <AppText
              variant="caption"
              tone="media"
              style={{ opacity: 0.6, marginTop: theme.spacing(1) }}
            >
              {photos[index].creditLine}
            </AppText>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * Một trang ảnh — tự lo chụm-để-phóng-to + kéo khi đã phóng + double-tap để
 * zoom nhanh. Báo `onZoomChange` lên cha để cha BẬT/TẮT gesture đóng-bằng-vuốt
 * (zoom rồi thì vuốt dọc phải di chuyển ảnh, không phải đóng trình xem).
 *
 * `saved*`: điểm xuất phát của LƯỢT TRƯỚC — gesture-handler cho delta TÍCH LUỸ từ lúc bắt đầu cử
 * chỉ (`e.scale`/`e.translationX/Y`), nên cần nhớ để cộng dồn đúng qua nhiều lượt chụm/kéo liên
 * tiếp. Tất cả là shared value: đọc/ghi đồng bộ trên luồng UI trong callback cử chỉ.
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
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const [zoomedLocal, setZoomedLocal] = useState(false);

  // Chạy trên JS: cập nhật state (bật/tắt Pan kéo ảnh và gesture đóng của cha).
  function notifyZoom(zoomed: boolean) {
    setZoomedLocal(zoomed);
    onZoomChange(zoomed);
  }

  function resetZoom() {
    'worklet';
    scale.value = withTiming(1, { duration: 200 });
    translateX.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    runOnJS(notifyZoom)(false);
  }

  function zoomTo(next: number) {
    'worklet';
    // Double-tap phóng bằng lò xo chứ không nhảy tức thì.
    scale.value = withSpring(next, { stiffness: 140, damping: 14 });
    savedScale.value = next;
    runOnJS(notifyZoom)(next > 1);
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clampZoomScale(savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) resetZoom();
      else runOnJS(notifyZoom)(true);
    });

  const panWhileZoomed = Gesture.Pan()
    // Chỉ nhận cử chỉ khi ảnh đã phóng: Pan con luôn thắng Pan cha, nên nếu bật cả lúc chưa zoom
    // thì cử chỉ vuốt-xuống-để-đóng ở `PhotoViewer` không bao giờ được kích hoạt.
    .enabled(zoomedLocal)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) resetZoom();
      else zoomTo(2.5);
    });

  const zoomGesture = Gesture.Simultaneous(pinch, panWhileZoomed, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={zoomGesture}>
      <Reanimated.View style={[{ flex: 1 }, imageStyle]}>
        <AppImage
          source={photo.url}
          // Truyền dp, không tự nhân 2 — `AppImage` đã nhân mật độ màn hình (L2).
          width={width}
          alt={photo.alt ?? ''}
          transformUrl={transformUrl}
          fill
          // `AppImage` gán cứng `contentFit="cover"` cho mọi chỗ khác (thumb/hero)
          // — trình xem cần `"contain"` (ảnh nguyên vẹn, không cắt); `rest` của
          // `AppImage` spread SAU giá trị mặc định nên ghi đè được, không cần
          // nhân bản component.
          contentFit="contain"
        />
      </Reanimated.View>
    </GestureDetector>
  );
}
