// Skeleton cấp route cho /tours. apps/web trước đây KHÔNG có loading.tsx ở bất
// kỳ route nào (Nexora có ở cả listing lẫn detail) — đây là chỗ nó có giá trị
// nhất vì listing sẽ là trang gọi API nặng nhất khi wire.
//
// VÌ SAO NẰM TRONG ROUTE GROUP `(listing)/` chứ không ở `tours/`: đặt ở `tours/`
// thì Suspense boundary của nó bọc luôn `[slug]`, và mọi slug lạ trả HTTP 200
// kèm giao diện 404 (soft 404 — crawler đem trang lỗi đi index). Route group
// không đổi URL: `/tours` vẫn là `/tours`. Xem giải thích đầy đủ ở đầu
// `tours/[slug]/page.tsx`. ĐỪNG chuyển file này lên một cấp.
//
// Khối giả phải khớp bố cục THẬT, nếu không nó thành lời hứa sai: bản đầu vẽ
// chip rail + lưới 3 cột card dọc, trong khi listing sau 4 vòng thiết kế lại là
// hàng tiêu đề khu vực + MỘT cột TourListCard hàng ngang. Nội dung về là trang
// nhảy layout — đúng cái mà skeleton tồn tại để tránh.

// Key ổn định thay vì index: danh sách này không bao giờ đổi thứ tự, nhưng
// dựng sẵn mảng id để khỏi phải tắt luật noArrayIndexKey.
// Mười hàng, không phải 12: DEFAULT_PAGE_SIZE của ToursExplorer là 10.
const ROW_KEYS = Array.from({ length: 10 }, (_, i) => `skeleton-row-${i + 1}`);

export default function ToursLoading() {
  return (
    <>
      {/* `bg-hero` trên section + `dark contents` bọc nội dung — đúng quy ước ở
          docs/conventions/color-system.md. Bản trước đặt `dark` lên chính
          section rồi dùng `bg-background`: ở dark mode `bg-background` bị đọc
          TRONG scope dark nên band trùng màu tuyệt đối với nền trang và biến
          mất. Đó là lỗi đã sửa cho hero thật ở 22bd75e; skeleton bị bỏ sót. */}
      <section className="relative w-full overflow-hidden bg-hero px-4 pt-36 pb-14 md:px-16 md:pb-16 lg:px-24 xl:px-32">
        <div className="dark contents">
          <div className="mx-auto max-w-7xl animate-pulse">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="mt-8 h-3 w-56 rounded bg-muted" />
            <div className="mt-3 h-12 w-full max-w-lg rounded bg-muted" />
            <div className="mt-4 h-4 w-full max-w-xl rounded bg-muted" />
            <div className="mt-8 h-11 w-full max-w-md rounded-full bg-muted" />
          </div>
        </div>
      </section>

      <div className="w-full px-4 py-14 md:px-16 md:py-16 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl animate-pulse">
          {/* Hàng tiêu đề khu vực: số kết quả cỡ h2 neo trái, sort + Filters bám
              mép phải, một đường kẻ khép hàng. Không khung, không nền. */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="h-8 w-32 rounded bg-muted" />
              <div className="flex shrink-0 items-center gap-2">
                <div className="h-9 w-40 rounded-md bg-muted" />
                <div className="h-9 w-24 rounded-md bg-muted" />
              </div>
            </div>
            <div className="mt-4 border-b" />
          </div>

          {/* Card hàng ngang: ảnh trái bề rộng cố định, thân giữa, rail giá phải
              — cùng ba khối của TourListCard nên chiều cao hàng khớp sẵn. */}
          <div className="flex flex-col gap-5">
            {ROW_KEYS.map((key) => (
              <div key={key} className="overflow-hidden rounded-2xl border bg-card sm:flex">
                <div className="aspect-16/10 w-full shrink-0 bg-muted sm:aspect-auto sm:w-60 lg:w-72" />

                <div className="flex flex-1 flex-col gap-5 p-5 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-56 rounded bg-muted" />
                    {/* Hai dòng tiêu đề: hợp đồng số dòng của card giữ chỗ 2
                        dòng kể cả khi tiêu đề chỉ chiếm 1. */}
                    <div className="h-5 w-3/4 rounded bg-muted" />
                    <div className="h-5 w-1/2 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-40 rounded bg-muted" />
                  </div>

                  <div className="flex shrink-0 items-end justify-between gap-3 border-t pt-4 sm:w-40 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                    <div className="space-y-2 sm:text-right">
                      <div className="h-7 w-24 rounded bg-muted" />
                      <div className="h-3 w-16 rounded bg-muted" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="size-8 rounded-md bg-muted" />
                      <div className="h-8 w-24 rounded-md bg-muted" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Thanh phân trang: "n/trang" trái · nút số giữa · dòng "Showing x–y
              of z" phải — giữ chỗ để đáy trang không nhảy khi dữ liệu về. */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
            <div className="h-9 w-40 rounded bg-muted" />
            <div className="h-9 w-52 rounded bg-muted" />
            <div className="h-4 w-36 rounded bg-muted" />
          </div>
        </div>
      </div>
    </>
  );
}
