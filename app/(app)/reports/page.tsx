import { Topbar } from "@/components/Topbar";
import { ReportsClient } from "@/components/ReportsClient";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  return (
    <>
      <Topbar title="Reports" sub="Live figures from your own fleet" />
      <ReportsClient />
    </>
  );
}
