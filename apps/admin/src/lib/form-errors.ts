/**
 * Form có ô nào hỏng không — một chỗ hỏi, để không nơi nào tự đếm keys.
 *
 * Rút về đây ở F15 (bài học 11 của plan P4e-2): hàm này đã có hai bản chép
 * nguyên văn (chuyến khởi hành và danh mục), và màn điểm đến sắp là bản thứ ba.
 * Bản của chuyến khởi hành CHƯA đổi sang dùng file này — code departures của
 * F16 nằm ngoài phạm vi F15.
 *
 * Nhận `object` chứ không `Record<string, …>`: kiểu lỗi của từng form khai bằng
 * `interface`, mà interface không có chữ ký chỉ mục ngầm nên không gán được
 * vào `Record`. Luật đếm giữ nguyên bản gốc — validator chỉ ghi khoá khi ô ấy
 * thật sự hỏng.
 */
export function hasFormErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}
