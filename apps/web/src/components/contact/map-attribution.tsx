// Attribution của tile OpenFreeMap. Tách khỏi `contact-map.tsx` vì hai lý do,
// cả hai đều thực dụng:
//
// 1. TEST ĐƯỢC. `contact-map.tsx` import `maplibre-gl` mà jsdom không có WebGL
//    nên spec nào chạm tới nó cũng phải mock cả module (xem
//    `contact-location.spec.tsx`) — nghĩa là ba link licence dưới đây sẽ không
//    có gì canh. Ở file riêng thì `map-attribution.spec.tsx` render thật được.
// 2. Nó là RÀNG BUỘC LICENCE (ADR-0018), không phải trang trí: nội dung giữ
//    nguyên như TileJSON của OpenFreeMap khai. Trước đây MapLibre tự render
//    khối này qua AttributionControl; ta thôi dùng control đó vì lý do bảo mật
//    ghi ở `contact-map.tsx` (GHSA-jrc7-96c5-q579), nên nghĩa vụ ghi công
//    chuyển sang đây.
export function MapAttribution() {
  return (
    <div className="absolute bottom-0 left-0 rounded-tr-md bg-background/80 px-1.5 py-0.5 text-muted-foreground text-xs backdrop-blur-sm">
      <a
        href="https://openfreemap.org"
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:underline"
      >
        OpenFreeMap
      </a>{' '}
      <a
        href="https://www.openmaptiles.org/"
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:underline"
      >
        &copy; OpenMapTiles
      </a>{' '}
      Data from{' '}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:underline"
      >
        OpenStreetMap
      </a>
    </div>
  );
}
