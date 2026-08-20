import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Separator } from '@tourism/ui/components/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@tourism/ui/components/sidebar';
import type { SessionUser } from '@/lib/api/session';
import { NAV_GROUPS } from '@/lib/nav';
import { NavUser } from './nav-user';

/**
 * Shell admin (spec P4a §3): sidebar shadcn 3 nhóm × 15 mục (phủ 18 vùng
 * khảo sát), mục `enabled: false` hiện badge "Soon" + disabled — KHÔNG link
 * chết (nghiệm thu §0.3). Server component; phần tương tác (nav-user, trigger)
 * là island con.
 */
export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const t = messages.admin.shell;
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* Wordmark hai tông — cùng nhận diện Logo của web, không mang SVG
              mark sang cho gọn sidebar hẹp. */}
          <a href="/" className="px-2 py-1.5 font-heading text-lg font-semibold tracking-tight">
            nex<span className="text-primary-emphasis">ora</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">back office</span>
          </a>
        </SidebarHeader>
        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.key}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      {item.enabled ? (
                        <SidebarMenuButton render={<a href={item.href} />}>
                          {item.label}
                        </SidebarMenuButton>
                      ) : (
                        <>
                          {/* Mục chưa mở: nút disabled thật (không href) —
                              vùng sẽ bật dần theo P4b–P4f. */}
                          <SidebarMenuButton disabled>{item.label}</SidebarMenuButton>
                          <SidebarMenuBadge>
                            <Badge variant="outline" className="text-[10px]">
                              {t.soon}
                            </Badge>
                          </SidebarMenuBadge>
                        </>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm text-muted-foreground">{t.dashboard}</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
