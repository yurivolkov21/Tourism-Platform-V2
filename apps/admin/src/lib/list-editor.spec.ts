import { describe, expect, it } from 'vitest';
import { moveItem, newItemKey, removeAt } from './list-editor';

describe('list-editor', () => {
  it('moveItem đổi chỗ đúng hai vị trí và không đụng mảng gốc', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 1, 0)).toEqual(['b', 'a', 'c']);
    expect(moveItem(items, 1, 2)).toEqual(['a', 'c', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('moveItem ra ngoài biên thì trả bản sao nguyên vẹn', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
    // `from` ngoài biên: không có kiểm biên thì `splice` chèn một `undefined`.
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('removeAt bỏ đúng một phần tử', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
  });

  it('newItemKey không lặp', () => {
    expect(newItemKey()).not.toBe(newItemKey());
  });
});
