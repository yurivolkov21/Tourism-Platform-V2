import { render, screen } from '@testing-library/react';
import { aboutPage } from '@tourism/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TEAM } from '@/mocks/team';
import { AboutTeam } from './about-team';

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

describe('AboutTeam — không có link giả', () => {
  // Review L8-10 (Yuri chọn "Bỏ hàng icon" ngày 21/10): mỗi người từng có icon "Website" và
  // "LinkedIn" trỏ `#team`, tức chính khu này, bấm không đi đâu. Đội là dữ liệu mock nên chưa có
  // link thật để gắn; khi có thì thêm lại cùng test cho link thật.
  it('khu Team chỉ còn ảnh, tên và vai trò, không link nào', () => {
    render(<AboutTeam />);
    for (const member of TEAM) {
      expect(screen.getByText(member.name)).toBeInTheDocument();
      expect(screen.getByText(member.role)).toBeInTheDocument();
    }
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  // Review L8-24: khu Team còn ba người từ 24/09 (`22f245f1` gỡ một thành viên) mà tiêu đề vẫn
  // ghi "Four faces,". Tiêu đề phải đếm đúng số người đang hiện.
  it('tiêu đề đếm đúng số người của khu Team', () => {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
    expect(aboutPage.team.titleLead.toLowerCase()).toBe(`${words[TEAM.length]} faces,`);
  });
});
