import type { Metadata } from "next";
import AIAdminActionsQueue from "@/components/AIAdminActionsQueue";
import AdminGate from "@/components/AdminGate";

export const metadata: Metadata = {
  title: "AI Actions Approval Queue | SalahNearMe",
  description: "Approve or reject AI suggested admin actions for SalahNearMe.",
};

export default function AIAdminActionsPage() {
  return (
    <AdminGate>
      <AIAdminActionsQueue />
    </AdminGate>
  );
}

