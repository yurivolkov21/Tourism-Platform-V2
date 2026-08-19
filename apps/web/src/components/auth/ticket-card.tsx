// Chữ ký cụm auth: form card kiểu TẤM VÉ (spec 2026-07-24) — mép trái đục lỗ
// perforation (radial-gradient chấm token border, mask cho thủng ra nền),
// chân card là CUỐNG VÉ: dòng IBM Plex Mono ngăn bằng đường nét đứt — lần đầu
// font mono của bộ ba font ra vai chính thức ("mã vé"). Đăng nhập = soát vé.
interface TicketCardProps {
  /** Dòng cuống vé mono, đổi theo trang — vd "HN → SAPA · GATE: LOGIN" */
  stub: string;
  children: React.ReactNode;
}

export function TicketCard({ stub, children }: TicketCardProps) {
  return (
    <div className="relative rounded-2xl border bg-card shadow-(--shadow-card)">
      {/* Dải đục lỗ dọc mép trái — chấm tròn màu nền "xuyên" qua card */}
      <div
        aria-hidden="true"
        className="absolute inset-y-4 left-0 w-4 -translate-x-1/2 [background:radial-gradient(circle_at_center,var(--background)_3px,transparent_3.5px)] [background-size:100%_18px]"
      />

      {/* p-6/p-8 (trước p-7/p-9): −8px dọc, một phần của vòng nén để card
          /register vừa laptop 768p (19/08). */}
      <div className="p-6 md:p-8">{children}</div>

      {/* Cuống vé: ngăn bằng nét đứt như đường xé, kèm vạch barcode giả lập */}
      <div className="flex items-center justify-between gap-4 border-t border-dashed px-6 py-3 md:px-8">
        {/* nowrap + size 10px: chừa chỗ cho barcode mà không gãy dòng ở max-w-md */}
        <p className="font-mono text-[10px] tracking-[0.18em] whitespace-nowrap text-muted-foreground uppercase">
          {stub}
        </p>
        {/* Barcode: 2 lớp repeating-gradient chu kỳ lệch nhau cho vạch dày mỏng ngẫu nhiên */}
        <div
          aria-hidden="true"
          className="hidden h-5 w-14 shrink-0 text-muted-foreground opacity-70 [background:repeating-linear-gradient(90deg,currentColor_0,currentColor_1.5px,transparent_1.5px,transparent_4px),repeating-linear-gradient(90deg,currentColor_0,currentColor_1px,transparent_1px,transparent_7px)] sm:block"
        />
      </div>
    </div>
  );
}
