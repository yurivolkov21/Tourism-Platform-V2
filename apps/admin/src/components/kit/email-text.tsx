/**
 * Email kèm một cơ hội xuống dòng ngay sau `@` (spec 2026-10-05 §4 #7). `LabelValueRow` bọc
 * giá trị trong `wrap-anywhere` (chống phình cột), nên email dài bị bẻ giữa chữ
 * ("…@gmail.co" / "m"). `<wbr>` cho trình duyệt một chỗ ngắt ĐẸP để dùng trước; ngắt bất
 * kỳ của `wrap-anywhere` chỉ còn là lưới cuối cho phần quá dài.
 */
export function EmailText({ email }: { email: string }) {
  const at = email.lastIndexOf('@');
  if (at <= 0) return <>{email}</>;
  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}
