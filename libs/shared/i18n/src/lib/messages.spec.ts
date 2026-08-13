import { messages } from './messages.js';

describe('messages: tourDetail', () => {
  it('tourDetail: mọi nhãn tab và copy modal đều có chữ', () => {
    const t = messages.tourDetail;
    expect(Object.values(t.tabs)).toHaveLength(5);
    for (const v of Object.values(t.tabs)) expect(v.trim().length).toBeGreaterThan(0);
    expect(t.dialogs.allDatesTitle.length).toBeGreaterThan(0);
    expect(t.dialogs.allReviewsTitle.length).toBeGreaterThan(0);
  });
});
