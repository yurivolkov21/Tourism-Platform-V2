/**
 * Ô "tên + mô tả" cho cột danh tính của bảng danh mục và bảng điểm đến.
 *
 * Rút về kit ở lượt thử tay F15 (24/09): hai bảng chép y nhau một khối
 * `truncate` KHÔNG có trần bề rộng. Trong bảng tự giãn, `truncate` không cắt
 * được gì — ô cứ nới theo chữ — nên một mô tả dài kéo cột rộng gần 900px và đẩy
 * mọi cột khác sang phải. User góp ý thu còn khoảng một nửa.
 *
 * Trần `max-w-md` (448px, khoảng nửa bề rộng cũ). Mô tả gói tối đa hai dòng thay
 * vì một dòng cắt cụt, và `title` giữ nguyên văn để rê chuột đọc đủ.
 */
export function NameDescriptionCell({ name, description }: { name: string; description: string }) {
  return (
    <div className="min-w-0 max-w-md">
      <div className="truncate font-medium text-foreground">{name}</div>
      {/* Ô bảng của kit UI mặc `whitespace-nowrap`; thiếu `whitespace-normal`
          thì mô tả không bao giờ xuống dòng và `line-clamp-2` vô tác dụng. */}
      <p
        className="line-clamp-2 text-xs whitespace-normal text-muted-foreground"
        title={description}
      >
        {description}
      </p>
    </div>
  );
}
