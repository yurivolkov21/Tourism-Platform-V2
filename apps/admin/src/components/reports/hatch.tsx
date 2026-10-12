/**
 * Vân chéo của bản in báo cáo (spec §2.4): nét màu giấy mờ 55% trên nền màu, ô 5 đơn vị — in trắng
 * đen vẫn tách đoạn có vân khỏi đoạn đặc. Thác nước và thanh trạng thái cùng một nét vân, chỉ khác góc.
 * Đặt trong `<defs>` của SVG dùng nó; `id` phải duy nhất trên trang.
 */
export function Hatch({ id, angle }: { id: string; angle: number }) {
  return (
    <pattern
      id={id}
      width={5}
      height={5}
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${angle})`}
    >
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={5}
        className="stroke-card"
        strokeOpacity={0.55}
        strokeWidth={1.6}
      />
    </pattern>
  );
}
