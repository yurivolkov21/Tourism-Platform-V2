import type * as React from 'react';

/**
 * Timeline APPEND-ONLY của back-office — một danh sách `<ol>` cũ-trước, mỗi
 * mục có vạch trái. Nâng lên kit ở vòng vá review F9: lịch sử huỷ của
 * `/bookings/[code]`, thread note và lịch sử trạng thái của `/enquiries/[id]`
 * từng là ba bản chép của cùng một khối markup (`grid gap-4` + `border-l-2
 * border-border pl-3`) — đổi viền/giãn dòng/empty state là ba lần sửa.
 *
 * Kit chỉ giữ KHUNG (danh sách + mục + empty state); nội dung mỗi mục là
 * việc của nơi gọi — ba consumer có ba ruột khác nhau (badge trạng thái,
 * đoạn văn, dòng "from → to").
 */
export function Timeline({
  empty,
  children,
}: {
  /** Câu in khi không có mục nào — bắt buộc, để không có `<ol>` rỗng câm. */
  empty: string;
  /** Các `<TimelineItem>`; mảng rỗng/`null` → in `empty`. */
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <ol className="grid gap-4">{items}</ol>;
}

/** Một mục của timeline — vạch trái, chữ nhỏ; ruột do nơi gọi dựng. */
export function TimelineItem({ children }: { children: React.ReactNode }) {
  return <li className="grid gap-1 border-l-2 border-border pl-3 text-sm">{children}</li>;
}
