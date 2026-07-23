'use client';

import { Button } from '@tourism/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@tourism/ui/components/sheet';
import { MenuIcon } from 'lucide-react';
import { Logo } from './logo';

// Island duy nhất của header — menu mobile bằng Sheet (các trang khác chưa có
// nên link trỏ #, thay dần khi từng trang được chốt).
export function MobileMenu({ links }: { links: { label: string; href: string }[] }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <MenuIcon />
          </Button>
        }
      />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Logo />
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <Button className="w-full">Book a tour</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
