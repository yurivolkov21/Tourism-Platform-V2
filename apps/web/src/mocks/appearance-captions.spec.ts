import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { MOMENTS } from './moments.js';
import { TEAM } from './team.js';

/**
 * Câu chú thích mà trang Appearance của admin in cạnh khe ảnh (spec P4f Appearance §3.1). Câu của
 * năm khoảnh khắc và chức danh ba người Team nằm trong mock của web, admin không import được, nên
 * `admin.appearance.copiedCaptions` là bản CHÉP — spec này canh bản chép đi theo bản gốc. Sửa chữ
 * ở mock mà quên bản chép thì admin nhắc sai cảnh khi người ta chọn ảnh thay.
 */
const copied: Record<string, string> = messages.admin.appearance.copiedCaptions;

describe('câu chú thích chép sang admin khớp mock của web', () => {
  it('năm khoảnh khắc: tiêu đề theo đúng khe', () => {
    for (const moment of MOMENTS) {
      expect(copied[moment.slot], moment.slot).toBe(moment.title);
    }
  });

  it('ba khe Team: chức danh, không phải tên người', () => {
    for (const member of TEAM) {
      expect(copied[member.slot], member.slot).toBe(member.role);
      expect(copied[member.slot]).not.toContain(member.name);
    }
  });

  it('bản chép không dư khe nào mà mock không còn', () => {
    const slots = [...MOMENTS.map((moment) => moment.slot), ...TEAM.map((member) => member.slot)];
    expect(Object.keys(copied).sort()).toEqual(slots.sort());
  });
});
