import { messages } from '@tourism/i18n';
import { Card, CardDescription, CardHeader, CardTitle } from '@tourism/ui/components/card';

const t = messages.admin.dashboardPlaceholder;

/** Dashboard placeholder (spec P4a §3) — số liệu thật là việc của P4d. */
export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">{t.title}</CardTitle>
          <CardDescription>{t.body}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
