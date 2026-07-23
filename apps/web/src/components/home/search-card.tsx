'use client';

import { Button } from '@tourism/ui/components/button';
import { Field, FieldGroup, FieldLabel } from '@tourism/ui/components/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@tourism/ui/components/input-group';
import { CalendarIcon, MapPinIcon, UsersIcon } from 'lucide-react';

// UI thuần giai đoạn static-first — submit no-op, gắn search thật khi có trang listing.
export function SearchCard() {
  return (
    <form
      className="w-full max-w-2xl rounded-xl bg-card/95 p-3 shadow-(--shadow-modal) backdrop-blur-sm"
      onSubmit={(e) => e.preventDefault()}
    >
      <FieldGroup className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field className="flex-1">
          <FieldLabel htmlFor="search-where">Where to</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <MapPinIcon />
            </InputGroupAddon>
            <InputGroupInput id="search-where" placeholder="Hạ Long, Sa Pa, Hội An…" />
          </InputGroup>
        </Field>
        <Field className="flex-1">
          <FieldLabel htmlFor="search-dates">Dates</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <CalendarIcon />
            </InputGroupAddon>
            <InputGroupInput id="search-dates" placeholder="Oct 12 – Oct 18" />
          </InputGroup>
        </Field>
        <Field className="flex-1">
          <FieldLabel htmlFor="search-travelers">Travelers</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <UsersIcon />
            </InputGroupAddon>
            <InputGroupInput id="search-travelers" placeholder="2 adults" />
          </InputGroup>
        </Field>
        <Button type="submit" size="lg" className="sm:mb-0.5">
          Search tours
        </Button>
      </FieldGroup>
    </form>
  );
}
