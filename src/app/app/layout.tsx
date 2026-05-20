import { AppShell } from "@/components/app-runtime/app-shell";
import { requireUser } from "@/lib/auth/organization";

export default async function AppRuntimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return <AppShell>{children}</AppShell>;
}
