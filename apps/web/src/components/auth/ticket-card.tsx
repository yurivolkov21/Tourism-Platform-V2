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

      <div className="p-7 md:p-9">{children}</div>

      {/* Cuống vé: ngăn bằng nét đứt như đường xé */}
      <div className="border-t border-dashed px-7 py-3.5 md:px-9">
        <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          {stub}
        </p>
      </div>
    </div>
  );
}
