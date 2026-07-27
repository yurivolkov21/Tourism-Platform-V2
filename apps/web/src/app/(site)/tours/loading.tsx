// Skeleton cấp route cho /tours. apps/web trước đây KHÔNG có loading.tsx ở bất
// kỳ route nào (Nexora có ở cả listing lẫn detail) — đây là chỗ nó có giá trị
// nhất vì listing sẽ là trang gọi API nặng nhất khi wire.
//
// Khối giả phải khớp bố cục thật (hero → toolbar → lưới 3 cột) để nội dung về
// không làm trang nhảy layout.
// Key ổn định thay vì index: danh sách này không bao giờ đổi thứ tự, nhưng
// dựng sẵn mảng id để khỏi phải tắt luật noArrayIndexKey.
const CHIP_KEYS = ['all', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
const CARD_KEYS = Array.from({ length: 12 }, (_, i) => `skeleton-card-${i + 1}`);

export default function ToursLoading() {
  return (
    <>
      <section className="dark w-full bg-background px-4 pt-36 pb-14 md:px-16 md:pb-16 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="mt-8 h-3 w-56 rounded bg-muted" />
          <div className="mt-4 h-12 w-full max-w-lg rounded bg-muted" />
          <div className="mt-5 h-4 w-full max-w-xl rounded bg-muted" />
          <div className="mt-8 h-11 w-full max-w-md rounded-full bg-muted" />
        </div>
      </section>

      <div className="w-full px-4 pb-16 md:px-16 md:pb-20 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="border-b py-4">
            <div className="flex gap-2">
              {/* Bảy chip: "All" + 6 chuyên mục — khớp số thật để thanh không co lại. */}
              {CHIP_KEYS.map((key) => (
                <div key={key} className="h-8 w-28 shrink-0 rounded-full bg-muted" />
              ))}
            </div>
            <div className="mt-4 h-6 w-24 rounded bg-muted" />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CARD_KEYS.map((key) => (
              <div key={key} className="overflow-hidden rounded-xl border">
                <div className="aspect-(--aspect-card) w-full bg-muted" />
                <div className="space-y-3 p-6">
                  <div className="h-3 w-20 rounded bg-muted" />
                  <div className="h-5 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-6 w-full rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
