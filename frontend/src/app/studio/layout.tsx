import { StudioShell } from "@/components/studio/studio-shell";
import { requireUser } from "@/server/lib/auth/organization";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return <StudioShell>{children}</StudioShell>;
}
