import { describe, expect, it } from 'vitest';
import { postTag, TAGS } from './tags';

describe('cache tags', () => {
  it('taxonomy cố định', () => {
    expect(TAGS.POSTS).toBe('posts');
  });
  it('postTag sinh tag theo slug, một định dạng duy nhất', () => {
    expect(postTag('eating-your-way-through-hoi-an')).toBe('post:eating-your-way-through-hoi-an');
  });
});
