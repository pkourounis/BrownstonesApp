import { requireProfile } from '@/lib/auth';
import { AppHeader } from '@/components/app-header';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-2xl px-4 pb-10 pt-4">{children}</main>
    </div>
  );
}
