import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeSessionUser } from '@/test/fixtures/account';
import { SettingsView } from './settings-view';

// Các thẻ bên trong gọi `useRouter`, Better Auth và client oRPC — ở đây chỉ dựng, không lưu gì.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/auth-client', () => ({
  authClient: { updateUser: vi.fn(), changePassword: vi.fn(), signOut: vi.fn() },
}));
vi.mock('@/lib/api/client', () => ({
  api: { media: { signUpload: vi.fn() }, account: { setAvatar: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

/** Trang `/account/settings` (spec 09/10 §1, §2 — phương án C). */
const cardOf = (title: string) =>
  screen.getByRole('heading', { level: 2, name: title }).closest('section') as HTMLElement;

describe('SettingsView', () => {
  it('hero giữ chữ cũ, có nút tròn "Back to Passport" về /account; không còn link chữ "← Passport"', () => {
    render(<SettingsView profile={makeSessionUser()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Traveler details' })).toBeInTheDocument();
    expect(screen.getByText('The information printed in your passport.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Passport' })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(screen.queryByText('← Passport')).not.toBeInTheDocument();
  });

  it('xếp đúng thẻ: thẻ danh tính trước, rồi Personal information, Password, Danger zone', () => {
    render(<SettingsView profile={makeSessionUser()} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Minh Anh',
      'Personal information',
      'Password',
      'Danger zone',
    ]);
  });

  it('đủ dòng: Personal information có Full name, Phone, Email; Password một dòng che chấm tròn', () => {
    render(<SettingsView profile={makeSessionUser()} />);
    expect(
      within(cardOf('Personal information'))
        .getAllByRole('listitem')
        .map((item) => item.querySelector('p')?.textContent),
    ).toEqual(['Full name', 'Phone', 'Email']);
    const password = cardOf('Password');
    expect(within(password).getAllByRole('listitem')).toHaveLength(1);
    expect(within(password).getByText('••••••••••')).toBeInTheDocument();
  });

  it('Connected accounts nằm trong thẻ danh tính, không còn mục riêng', () => {
    const { container } = render(<SettingsView profile={makeSessionUser()} />);
    const identity = container.querySelector('[data-slot="identity-card"]') as HTMLElement;
    expect(
      within(identity).getByRole('heading', { level: 3, name: 'Connected accounts' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Email & password')).toHaveLength(1);
    expect(screen.queryByText('Sign-in methods linked to your account.')).not.toBeInTheDocument();
  });

  it('bố cục: hai cột từ lg (trái 20rem, khe 24px, khung 1024px); thẻ danh tính đứng đầu, chỉ dính từ lg', () => {
    const { container } = render(<SettingsView profile={makeSessionUser()} />);
    const layout = container.querySelector('[data-slot="settings-layout"]');
    expect(layout).toHaveClass(
      'mx-auto',
      'max-w-5xl',
      'lg:grid-cols-[20rem_minmax(0,1fr)]',
      'lg:items-start',
      'lg:gap-6',
    );
    const identity = container.querySelector('[data-slot="identity-card"]');
    expect(layout?.firstElementChild).toBe(identity);
    expect(identity).toHaveClass('lg:sticky', 'lg:top-28');
    expect(identity).not.toHaveClass('sticky');
    expect(layout?.parentElement).toHaveClass('px-4', 'lg:px-8');
  });
});
