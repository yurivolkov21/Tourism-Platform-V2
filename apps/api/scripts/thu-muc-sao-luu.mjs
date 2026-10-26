/**
 * Chọn tên thư mục con trong `backups/` cho một lượt `snapshot:export`.
 *
 * Bản sao lưu là thứ DUY NHẤT còn giữ dữ liệu vận hành sau `data:reset --apply`
 * (thư mục bị gitignore, nằm trên máy người chạy). Ngày seed lại, người chạy rất
 * dễ export lần nữa trong cùng ngày: để có keep-list mới khi chạy lại reset, hoặc
 * chỉ để xem số liệu. Nếu lượt sau ghi vào đúng `backups/<ngày>/` thì bản chụp
 * TRƯỚC reset bị thay bằng bản chụp một DB đã xoá sạch, mà không ai hay. Vì vậy
 * thư mục của ngày đã có thì lượt sau sang `<ngày>-2`, `<ngày>-3`…: không bao giờ
 * ghi đè.
 *
 * @param {string} ngay Ngày của lượt export, dạng `YYYY-MM-DD`.
 * @param {(ten: string) => boolean} daCo Cho biết `backups/<ten>` đã tồn tại chưa.
 * @returns {string} Tên thư mục còn trống đầu tiên.
 */
export function chonThuMucSaoLuu(ngay, daCo) {
  if (!daCo(ngay)) return ngay;
  for (let i = 2; ; i++) {
    const ten = `${ngay}-${i}`;
    if (!daCo(ten)) return ten;
  }
}
