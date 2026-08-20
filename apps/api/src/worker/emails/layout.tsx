import { messages } from '@tourism/i18n';
import { theme } from '@tourism/tokens/theme';
import type { ReactNode } from 'react';
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'react-email';

/**
 * Hệ visual email (ADR-0025, cập nhật vòng 2 — 20/08): PORT nguyên cấu trúc
 * từ `email.templates.ts` của Nexora tiền nhiệm — bản thân nó là port template
 * "Barebone" (MIT) của react.email, user đã duyệt 13/07 trong một vòng thiết
 * kế. Cấu trúc: khung TRẮNG 640px (mini-header N-square + wordmark) → card
 * nội dung XÁM căn giữa (monogram 48px, heading lớn, đoạn văn ≤400px) → các
 * khối trắng lồng trong (data card nhãn/giá trị + hairline, quote card, pill,
 * nút CTA) → footer tagline + "why you got this" + unsubscribe.
 *
 * Khác bản cũ đúng hai điểm: (1) màu nhuộm lại từ hex hardcode sang
 * `@tourism/tokens/theme` — nguồn là token, đổi token là email đổi theo;
 * (2) heading dùng stack serif Literata theo nhận diện v2 (bản cũ Inter).
 * Email luôn palette light: dark mode của email client tự đảo màu mỗi nơi
 * một kiểu, một nền sáng ổn định là đường an toàn duy nhất.
 */
const c = theme.colors.light;

/**
 * Font stack email-safe: KHÔNG nhúng webfont (Gmail lột <link>/<style> ngoài
 * whitelist, Outlook desktop bỏ qua @font-face) — dùng stack fallback cùng
 * "họ" với bộ font web (ADR-0013 #6): Literata → Georgia (serif có nét
 * chuyển), Archivo → Helvetica/Arial (grotesque).
 */
/**
 * Mark "Slidex" hai viên kim cương — PNG trên CDN (user nhắc 20/08: mail
 * cũng phải dùng logo dự án). PHẢI là <img> vì Gmail lột inline SVG; PNG
 * xuất từ logo.tsx với màu token light ghim cứng (email luôn palette light).
 */
const MARK_URL = 'https://res.cloudinary.com/dbkgeehow/image/upload/tourism/brand/nexora-mark.png';

export const SERIF = "Literata, Georgia, 'Times New Roman', serif";
export const SANS = "Archivo, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Đoạn văn thân mail — căn giữa, gói ≤400px như bản gốc Barebone. */
export function BodyParagraph({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: '0 auto 28px',
        maxWidth: '400px',
        fontFamily: SANS,
        fontSize: '15px',
        lineHeight: '1.55',
        color: c.foreground,
      }}
    >
      {children}
    </Text>
  );
}

/** Ghi chú xám nhỏ khép card nội dung (voucher, "reply to this email"…). */
export function NoteParagraph({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: '32px auto 0',
        maxWidth: '400px',
        fontFamily: SANS,
        fontSize: '13px',
        lineHeight: '1.5',
        color: c['muted-foreground'],
      }}
    >
      {children}
    </Text>
  );
}

/** Giá trị thường trong data card. */
export function PlainValue({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500, color: c.foreground }}>
      {children}
    </span>
  );
}

/** Giá trị tiền — đậm và nhuộm primary như bản cũ nhuộm brand. */
export function MoneyValue({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 600, color: c.primary }}>
      {children}
    </span>
  );
}

/** Pill trạng thái ("Under review") — nền secondary, chữ ink theo token. */
export function PillValue({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: c.secondary,
        color: c['secondary-foreground'],
        fontFamily: SANS,
        fontSize: '12px',
        fontWeight: 600,
        padding: '5px 12px',
        borderRadius: '999px',
      }}
    >
      {children}
    </span>
  );
}

/**
 * Data card TRẮNG: mỗi hàng nhãn-trái (xám) / giá-trị-phải, ngăn nhau bằng
 * hairline — đúng khối đặc trưng của Barebone. Giá trị nhận sẵn node đã bọc
 * PlainValue/MoneyValue/PillValue.
 */
export function DataCard({ rows }: { rows: Array<[label: string, value: ReactNode]> }) {
  return (
    <Section
      style={{
        backgroundColor: c.card,
        borderRadius: '8px',
        margin: '0 0 28px',
        padding: '8px 24px',
      }}
    >
      {rows.map(([label, value], i) => (
        <Row key={label} style={i > 0 ? { borderTop: `1px solid ${c.secondary}` } : undefined}>
          <Column
            style={{
              padding: '13px 0',
              fontFamily: SANS,
              fontSize: '13px',
              color: c['muted-foreground'],
              textAlign: 'left' as const,
            }}
          >
            {label}
          </Column>
          <Column style={{ padding: '13px 0', textAlign: 'right' as const }}>{value}</Column>
        </Row>
      ))}
    </Section>
  );
}

/** Quote card TRẮNG: nhãn small-caps + nội dung nghiêng (message khách, lý do). */
export function QuoteCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: c.card,
        borderRadius: '8px',
        margin: '0 0 28px',
        padding: '20px 24px',
        textAlign: 'left' as const,
      }}
    >
      <Text
        style={{
          margin: '0 0 6px',
          fontFamily: SANS,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '1px',
          color: c['muted-foreground'],
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          margin: 0,
          fontFamily: SANS,
          fontStyle: 'italic',
          fontSize: '14px',
          lineHeight: '1.6',
          color: c.foreground,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

/** Nút CTA duy nhất của mail — bg primary, đúng cữ 16/28 của bản cũ. */
export function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: '0 0 4px' }}>
      <a
        href={href}
        style={{
          display: 'inline-block',
          maxWidth: '280px',
          backgroundColor: c.primary,
          color: c['primary-foreground'],
          fontFamily: SANS,
          fontSize: '15px',
          fontWeight: 500,
          lineHeight: '24px',
          textDecoration: 'none',
          textAlign: 'center' as const,
          borderRadius: '8px',
          padding: '14px 28px',
        }}
      >
        {children}
      </a>
    </Section>
  );
}

/** Ô mã OTP to-rõ — khối trắng cùng họ data card, mã mono letter-spaced. */
export function CodeBox({ code }: { code: string }) {
  return (
    <Section
      style={{
        backgroundColor: c.card,
        borderRadius: '8px',
        margin: '0 0 28px',
        padding: '22px 24px',
        textAlign: 'center' as const,
      }}
    >
      <Text
        style={{
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
          fontSize: '32px',
          fontWeight: 600,
          letterSpacing: '8px',
          color: c.ink,
          margin: 0,
        }}
      >
        {code}
      </Text>
    </Section>
  );
}

/** Mark "Slidex" giữa card — PNG từ CDN, tỉ lệ gốc 46:33. */
function Monogram({ width }: { width: number }) {
  const height = Math.round((width * 33) / 46);
  return (
    <Section style={{ margin: '0 0 20px' }}>
      <Img
        src={MARK_URL}
        width={width}
        height={height}
        alt="Nexora"
        style={{ display: 'inline-block' }}
      />
    </Section>
  );
}

export interface EmailShellProps {
  /** Dòng preview hiện cạnh subject trong inbox (chưa mở đã đọc được). */
  preview: string;
  /** Heading lớn giữa card xám. */
  heading: string;
  /** Khối trên heading — mặc định monogram 48px. */
  top?: ReactNode;
  /** Các khối nội dung: BodyParagraph / DataCard / QuoteCard / CtaButton. */
  children: ReactNode;
  /** NoteParagraph khép card (đã bọc sẵn). */
  note?: ReactNode;
  /** Dòng "why you got this" ở footer — mail nào cũng nên khai. */
  footerReason?: string;
  /** NEWSLETTER_WELCOME: link trang huỷ đăng ký ở footer. */
  unsubscribeUrl?: string;
}

/**
 * Shell Barebone: khung trắng 640 → mini-header → card xám căn giữa → footer.
 * Mọi template đi qua đây — đổi shell là đổi cả 13 loại mail.
 */
export function EmailShell({
  preview,
  heading,
  top,
  children,
  note,
  footerReason,
  unsubscribeUrl,
}: EmailShellProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: c.paper }}>
        <Section style={{ backgroundColor: c.paper, padding: '32px 12px' }}>
          <Container
            style={{
              maxWidth: '640px',
              backgroundColor: c.card,
              borderRadius: '12px',
            }}
          >
            {/* Mini-header: N-square trái · wordmark phải (nhận diện v2). */}
            <Section style={{ padding: '16px 24px 12px' }}>
              <Row>
                <Column style={{ textAlign: 'left' as const }}>
                  <Img
                    src={MARK_URL}
                    width={33}
                    height={24}
                    alt=""
                    style={{ display: 'inline-block' }}
                  />
                </Column>
                <Column style={{ textAlign: 'right' as const }}>
                  <span
                    style={{
                      fontFamily: SERIF,
                      fontSize: '15px',
                      fontWeight: 600,
                      color: c.foreground,
                    }}
                  >
                    nex<span style={{ color: c['primary-emphasis'] }}>ora</span>
                  </span>
                </Column>
              </Row>
            </Section>

            {/* Card nội dung xám — mọi thứ căn giữa như bản gốc Barebone. */}
            <Section style={{ padding: '0 24px' }}>
              <Section
                style={{
                  backgroundColor: c.paper,
                  borderRadius: '8px',
                  padding: '48px 40px 52px',
                  textAlign: 'center' as const,
                }}
              >
                {top ?? <Monogram width={56} />}
                <Text
                  style={{
                    margin: '0 0 12px',
                    fontFamily: SERIF,
                    fontSize: '27px',
                    lineHeight: '1.3',
                    fontWeight: 600,
                    letterSpacing: '-0.3px',
                    color: c.foreground,
                  }}
                >
                  {heading}
                </Text>
                {children}
                {note ?? null}
              </Section>
            </Section>

            {/* Footer: tagline + site + why-you-got-this + unsubscribe. */}
            <Section style={{ padding: '36px 24px 40px', textAlign: 'center' as const }}>
              <Text
                style={{
                  margin: '0 auto',
                  maxWidth: '280px',
                  fontFamily: SANS,
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: c['muted-foreground'],
                }}
              >
                {/* Hạ chữ đầu tagline cho hợp giữa câu — KHÔNG toLowerCase cả chuỗi
                  (từng nuốt chữ hoa "Vietnam"). */}
                {`${messages.brand.name} — ${messages.brand.tagline.charAt(0).toLowerCase()}${messages.brand.tagline.slice(1)}.`}
              </Text>
              <Text
                style={{
                  margin: '14px 0 0',
                  fontFamily: SANS,
                  fontSize: '11px',
                  lineHeight: '1.5',
                  color: c['muted-foreground'],
                }}
              >
                <Link
                  href="https://www.nexora-travel.agency"
                  style={{ color: c['muted-foreground'], textDecoration: 'underline' }}
                >
                  nexora-travel.agency
                </Link>
              </Text>
              {footerReason ? (
                <Text
                  style={{
                    margin: '14px 0 0',
                    fontFamily: SANS,
                    fontSize: '11px',
                    lineHeight: '1.5',
                    color: c['muted-foreground'],
                  }}
                >
                  {footerReason}
                </Text>
              ) : null}
              {unsubscribeUrl ? (
                <Text
                  style={{
                    margin: '14px 0 0',
                    fontFamily: SANS,
                    fontSize: '11px',
                    lineHeight: '1.5',
                    color: c['muted-foreground'],
                  }}
                >
                  <Link
                    href={unsubscribeUrl}
                    style={{ color: c['muted-foreground'], textDecoration: 'underline' }}
                  >
                    Unsubscribe
                  </Link>
                </Text>
              ) : null}
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

/** Style link nhấn trong đoạn văn (màu primary từ token) — dùng ở template. */
export const accentLink = {
  color: theme.colors.light.primary,
  fontWeight: 500,
} as const;
