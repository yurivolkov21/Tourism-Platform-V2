/** Một dòng đã tách được giờ, hoặc một dòng in nguyên (không khớp mẫu). */
export type ItineraryLine =
  | { kind: 'timed'; time: string; text: string }
  | { kind: 'plain'; text: string };

const TIMED_LINE = /^(\d{1,2}:\d{2})\s*[—-]\s*(.+)$/;

/**
 * Tách mô tả một ngày (D2, handoff §1): seed nối nhiều dòng "09:00 — …" bằng
 * xuống dòng. QUYẾT ĐỊNH THEO TỪNG DÒNG — dòng khớp mẫu "HH:MM — chữ" tách
 * giờ ra cột trái, dòng không khớp in nguyên dòng, không ép vào cột giờ.
 */
export function parseItineraryDescription(description: string | null): ItineraryLine[] {
  if (description === null) return [];

  return description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line): ItineraryLine => {
      const match = line.match(TIMED_LINE);
      return match
        ? { kind: 'timed', time: match[1] as string, text: match[2] as string }
        : { kind: 'plain', text: line };
    });
}
