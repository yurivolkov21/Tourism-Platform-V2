import { describe, expect, it } from 'vitest';
import { typesetVariants } from './typeset';

// Logic thuần duy nhất của wrapper: mapping preset → chuỗi class (ADR-0012 #5).
describe('typesetVariants', () => {
  it('mặc định rơi về preset docs', () => {
    expect(typesetVariants()).toBe('typeset typeset-docs');
  });

  it.each([
    ['docs', 'typeset-docs'],
    ['chat', 'typeset-chat'],
    ['reading', 'typeset-reading'],
  ] as const)('preset %s sinh class %s kèm class gốc typeset', (preset, expected) => {
    const classes = typesetVariants({ preset }).split(' ');
    expect(classes).toContain('typeset');
    expect(classes).toContain(expected);
  });

  it('preset undefined vẫn dùng defaultVariants docs', () => {
    expect(typesetVariants({ preset: undefined })).toBe('typeset typeset-docs');
  });
});
