'use client';

import MapLibreGL from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPinIcon, MinusIcon, PlusIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveThemeNow, useResolvedTheme } from '@/lib/use-resolved-theme';
import { OFFICES } from '@/mocks/offices';

// Bản đồ §Location của /contact — thay ô ImagePlaceholder (ADR-0018).
// Viết riêng dùng thẳng maplibre-gl thay vì port lớp primitive mapcn của
// Nexora: ta chỉ cần 2 marker + 2 nút zoom, còn primitive kia kéo theo ~700
// dòng máy móc tổng quát (popup, tooltip, GeoJSON, arc, cluster, projection).
// Client-only + WebGL nên PHẢI nạp qua dynamic(ssr:false) — xem contact-location.

// Tile OpenFreeMap: miễn phí, không API key, dữ liệu OpenStreetMap. Đây là
// ngoại lệ luật tokens-only đã ghi trong ADR-0018 — URL style là JSON host
// ngoài, không biểu diễn được bằng @tourism/tokens. Mọi thứ ta vẽ đè lên
// (marker, nút zoom) vẫn dùng token tuyệt đối.
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

// Hà Nội ↔ Hồ Chí Minh cách ~1150km: đặt center/zoom cứng là mất một đầu, nên
// khung nhìn tính từ chính toạ độ 2 văn phòng. Thêm văn phòng thứ ba thì map
// tự giãn, không phải chỉnh số.
function officeBounds(): MapLibreGL.LngLatBounds {
  const bounds = new MapLibreGL.LngLatBounds();
  for (const office of OFFICES) bounds.extend(office.coords);
  return bounds;
}

/** Pin thương hiệu — vòng ping tắt khi user xin giảm chuyển động. */
function MarkerPin() {
  return (
    <span className="relative flex size-9 items-center justify-center">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 motion-reduce:hidden" />
      <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background">
        <MapPinIcon className="size-4.5" aria-hidden="true" />
      </span>
    </span>
  );
}

export default function ContactMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreGL.Map | null>(null);
  // Mỗi marker là một <div> rỗng do MapLibre định vị; nội dung React đổ vào
  // bằng portal để vẫn viết được JSX + icon lucide + class token.
  const [markerHosts, setMarkerHosts] = useState<{ city: string; el: HTMLElement }[]>([]);
  const theme = useResolvedTheme();

  // Khởi tạo map ĐÚNG MỘT LẦN. `theme` cố tình không nằm trong deps — đổi
  // theme thì setStyle ở effect dưới, dựng lại cả map sẽ nháy trắng và mất
  // vị trí khách đang kéo tới. Không cần biome-ignore: mọi giá trị effect này
  // đọc (MapLibreGL, STYLES, OFFICES, resolveThemeNow, setMap, setMarkerHosts)
  // đều ổn định (import module-scope hoặc setState) nên rule
  // useExhaustiveDependencies không bắt lỗi thiếu dep ở đây — đã kiểm bằng
  // cách chạy biome check khi bỏ comment: 0 diagnostic.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const instance = new MapLibreGL.Map({
      container,
      // Đọc theme đồng bộ để lần vẽ đầu đã đúng màu, không nháy sáng rồi tối.
      style: STYLES[resolveThemeNow()],
      bounds: officeBounds(),
      fitBoundsOptions: { padding: 64 },
      // Không cướp cuộn trang: lăn chuột vẫn cuộn trang, muốn zoom thì bấm nút.
      scrollZoom: false,
      dragRotate: false,
      touchZoomRotate: false,
      // Attribution OpenStreetMap là ràng buộc licence (ADR-0018) — GIỮ, đừng tắt.
      attributionControl: { compact: true },
    });

    setMap(instance);

    const hosts = OFFICES.map((office) => {
      const el = document.createElement('div');
      new MapLibreGL.Marker({ element: el }).setLngLat(office.coords).addTo(instance);
      return { city: office.city, el };
    });
    setMarkerHosts(hosts);

    return () => {
      instance.remove();
      setMap(null);
      setMarkerHosts([]);
    };
  }, []);

  // Đổi theme → đổi style tile, giữ nguyên khung nhìn.
  useEffect(() => {
    if (!map) return;
    map.setStyle(STYLES[theme]);
  }, [map, theme]);

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="size-full" />

      {markerHosts.map(({ city, el }) => createPortal(<MarkerPin />, el, city))}

      {/* Nút zoom tự vẽ thay NavigationControl mặc định — control của MapLibre
          có style riêng, không theo token được. */}
      <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg shadow-md ring-1 ring-border">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => map?.zoomIn()}
          className="flex size-9 items-center justify-center bg-background text-foreground transition-colors hover:bg-muted"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => map?.zoomOut()}
          className="flex size-9 items-center justify-center border-t border-border bg-background text-foreground transition-colors hover:bg-muted"
        >
          <MinusIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
