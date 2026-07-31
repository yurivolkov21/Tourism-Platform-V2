import { describe, expect, it } from 'vitest';
import { postTag, TAGS, tourTag } from './tags';

describe('cache tags', () => {
  it('taxonomy cố định', () => {
    expect(TAGS.POSTS).toBe('posts');
    expect(TAGS.TOURS).toBe('tours');
  });
  it('postTag sinh tag theo slug, một định dạng duy nhất', () => {
    expect(postTag('eating-your-way-through-hoi-an')).toBe('post:eating-your-way-through-hoi-an');
  });
  it('tourTag sinh tag theo slug, đối xứng với postTag', () => {
    expect(tourTag('hoi-an-ancient-town')).toBe('tour:hoi-an-ancient-town');
  });
});
