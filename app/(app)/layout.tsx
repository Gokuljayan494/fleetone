import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "owner") redirect("/login");
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">{children}</div>
    </div>
  );
}
