/**
 * Toạ độ 19 địa danh — dùng để tìm ảnh Wikimedia Commons bằng `list=geosearch`.
 *
 * Vì sao toạ độ nằm ở ĐÂY chứ không phải trong `Destination`: đây là metadata
 * phục vụ việc TÌM NGUỒN ẢNH, không phải dữ liệu sản phẩm. Site không có bản đồ
 * địa danh, không có tính năng nào đọc toạ độ này. Nhét vào schema là thêm cột
 * chết. Nếu sau này có bản đồ địa danh thì lúc đó mới migrate lên.
 *
 * `radiusKm` chỉnh theo tầm vóc từng nơi: thành phố lấy hẹp để không kéo ảnh
 * ngoại thành; vịnh/vườn quốc gia lấy rộng vì cảnh trải dài. Đây là số đã đo
 * bằng tay — nới rộng thì lẫn ảnh nơi khác, thu hẹp thì không đủ ảnh.
 *
 * `terms` là từ khoá dự phòng cho Pixabay khi Commons không đủ 10 ảnh đạt.
 */
export interface DestinationSource {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  terms: string[];
}

export const destinationSources: DestinationSource[] = [
  // ---- Miền Bắc ----
];
