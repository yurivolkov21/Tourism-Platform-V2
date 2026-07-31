import { describe, expect, it } from 'vitest';
import { tocFromLegalDoc, tocFromMarkdown, tocFromSections } from './toc.js';

const doc = {
  title: 'Terms',
  breadcrumb: 'Terms',
  updated: 'Last updated: 25 July 2026',
  intro: ['Intro paragraph.'],
  sections: [
    { heading: 'Booking and your contract', paragraphs: ['a'] },
    { heading: 'Prices, inclusions and payment', paragraphs: ['b'] },
  ],
};

describe('tocFromLegalDoc', () => {
  it('mỗi section thành một mục, id khớp slugify', () => {
    expect(tocFromLegalDoc(doc)).toEqual([
      { id: 'booking-and-your-contract', label: 'Booking and your contract', index: '01' },
      { id: 'prices-inclusions-and-payment', label: 'Prices, inclusions and payment', index: '02' },
    ]);
  });

  it('đánh số hai chữ số cho cột mono', () => {
    const many = {
      ...doc,
      sections: Array.from({ length: 11 }, (_, i) => ({ heading: `Section ${i}` })),
    };
    expect(tocFromLegalDoc(many).at(-1)?.index).toBe('11');
  });

  it('doc không có section thì trả mảng rỗng', () => {
    expect(tocFromLegalDoc({ ...doc, sections: [] })).toEqual([]);
  });
});

describe('tocFromSections', () => {
  it('dựng mục lục từ mảng section bất kỳ, không cần cả LegalDoc', () => {
    expect(tocFromSections([{ heading: 'Getting there' }, { heading: 'What to eat' }])).toEqual([
      { id: 'getting-there', label: 'Getting there', index: '01' },
      { id: 'what-to-eat', label: 'What to eat', index: '02' },
    ]);
  });

  it('mảng rỗng trả mảng rỗng', () => {
    expect(tocFromSections([])).toEqual([]);
  });
});

describe('tocFromMarkdown', () => {
  it('lấy H2 theo thứ tự, id slugify, index pad 2 chữ số', () => {
    const md = '## Layers beat one big coat\n\nbody\n\n## Shoes that already know mud\n';
    expect(tocFromMarkdown(md)).toEqual([
      { id: 'layers-beat-one-big-coat', label: 'Layers beat one big coat', index: '01' },
      { id: 'shoes-that-already-know-mud', label: 'Shoes that already know mud', index: '02' },
    ]);
  });

  it('bỏ qua H3 và heading nằm trong code fence', () => {
    const md = '### not me\n```\n## fenced\n```\n## real one\n';
    expect(tocFromMarkdown(md).map((i) => i.label)).toEqual(['real one']);
  });
});
