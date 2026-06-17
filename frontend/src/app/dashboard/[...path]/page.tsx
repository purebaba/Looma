import { redirect } from "next/navigation";

const DASHBOARD_TO_STUDIO_PREFIXES = [
  {
    from: ["forms"],
    to: ["interfaces", "forms"],
  },
  {
    from: ["apps"],
    to: ["apps"],
  },
  {
    from: ["data"],
    to: ["data"],
  },
  {
    from: ["workflows"],
    to: ["workflows"],
  },
  {
    from: ["agents"],
    to: ["agents"],
  },
  {
    from: ["team"],
    to: ["team"],
  },
  {
    from: ["settings"],
    to: ["settings"],
  },
];

export default async function DashboardCatchAllRedirectPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const mapping = DASHBOARD_TO_STUDIO_PREFIXES.find(
    (item) => item.from[0] === path[0]
  );

  if (!mapping) {
    redirect("/studio");
  }

  const rest = path.slice(mapping.from.length);
  redirect(`/${["studio", ...mapping.to, ...rest].join("/")}`);
}
