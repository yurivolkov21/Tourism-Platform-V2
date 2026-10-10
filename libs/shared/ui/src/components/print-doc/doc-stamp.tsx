import { cn } from '@tourism/ui/lib/utils';

export type DocStampTone = 'confirmed' | 'pending' | 'muted';

/**
 * Màu và độ nghiêng của mộc trên giấy (G40). `confirmed` là teal `primary`, KHÔNG `success`: mộc
 * xanh lá chỉ đạt 2,8:1 trên nền sáng (G32). `pending` là token của tài liệu in, nghiêng ngược như
 * bản thảo B1.
 */
export const STAMP_TONE_CLASS: Record<DocStampTone, string> = {
  confirmed: 'rotate-[3deg] border-primary text-primary outline-primary',
  pending: '-rotate-2 border-pending text-pending outline-pending',
  muted: 'rotate-[3deg] border-muted-foreground text-muted-foreground outline-muted-foreground',
};

export function DocStamp({
  label,
  tone,
  className,
}: {
  label: string;
  tone: DocStampTone;
  className?: string;
}) {
  return (
    <span
      data-slot="doc-stamp"
      data-tone={tone}
      className={cn(
        'inline-block shrink-0 rounded-[1.2mm] border-[1.2pt] px-[3mm] py-[1.4mm] font-heading text-[8pt] font-semibold tracking-[0.2em] uppercase outline outline-[0.5pt] outline-offset-[0.8mm]',
        STAMP_TONE_CLASS[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
