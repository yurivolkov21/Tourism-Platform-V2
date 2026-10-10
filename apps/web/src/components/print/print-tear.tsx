/** Dòng xé giữa tấm vé và phần dưới (5b, B1): chữ giữa hai vạch đứt. */
export function PrintTear({ text }: { text: string }) {
  return (
    <p
      data-slot="print-tear"
      className="mt-[4mm] mb-[6mm] flex items-center gap-[3mm] text-[7.5pt] text-muted-foreground before:flex-1 before:border-t-[0.8pt] before:border-dashed before:border-border after:flex-1 after:border-t-[0.8pt] after:border-dashed after:border-border"
    >
      {text}
    </p>
  );
}
