/**
 * Nhãn nút giữ chỗ cho biến thể RỘNG NHẤT của nó.
 *
 * Nút đổi trạng thái của một hàng bảng mang hai nhãn luân phiên ("Hide"/"Show"
 * ở danh mục, "Close"/"Reopen" ở chuyến khởi hành), mỗi nhãn một bề rộng. Cụm
 * nút canh phải, nên hàng nào đang mang nhãn hẹp hơn thì mọi nút bên trái nó bị
 * kéo lệch khỏi cột của hàng trên (lượt thử tay F14, 23/09).
 *
 * Cách làm: xếp CHỒNG mọi nhãn vào cùng một ô lưới — ô ấy rộng bằng nhãn rộng
 * nhất — rồi chỉ cho nhãn hiện tại thấy được. Không phải đoán một bề rộng cố
 * định bằng pixel, nên sửa câu chữ sau này không làm vỡ bố cục.
 *
 * Nhãn giữ chỗ mang `aria-hidden`: không có nó thì trình đọc màn hình đọc một
 * nút "Hide" thành "Hide Show".
 */
export function StableLabel({
  label,
  reserve,
}: {
  /** Nhãn đang hiện. */
  label: string;
  /** Mọi nhãn mà ô này có thể mang — nhãn hiện tại có mặt hay không đều được. */
  reserve: readonly string[];
}) {
  return (
    <span className="grid">
      <span className="col-start-1 row-start-1">{label}</span>
      {reserve
        .filter((other) => other !== label)
        .map((other) => (
          <span key={other} aria-hidden="true" className="invisible col-start-1 row-start-1">
            {other}
          </span>
        ))}
    </span>
  );
}
