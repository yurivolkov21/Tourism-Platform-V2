import { describe, expect, it } from 'vitest';
import { contentState, settle } from './resilience';

describe('settle', () => {
  it('promise resolve → {ok:true, data}', async () => {
    expect(await settle(Promise.resolve([1]))).toEqual({ ok: true, data: [1] });
  });
  it('promise reject → {ok:false, data:null} và KHÔNG throw', async () => {
    expect(await settle(Promise.reject(new Error('down')))).toEqual({ ok: false, data: null });
  });
});

describe('contentState', () => {
  it('failed thắng isEmpty — API sập không được hiện empty-state (nói dối)', () => {
    expect(contentState({ failed: true, isEmpty: true })).toBe('error');
  });
  it('rỗng thật → empty; có dữ liệu → content', () => {
    expect(contentState({ failed: false, isEmpty: true })).toBe('empty');
    expect(contentState({ failed: false, isEmpty: false })).toBe('content');
  });
});
