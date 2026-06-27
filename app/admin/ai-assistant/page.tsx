import type { Metadata } from "next";
import AdminAIAssistant from "@/components/AdminAIAssistant";
import AdminGate from "@/components/AdminGate";

export const metadata: Metadata = {
  title: "AI Admin Assistant | SalahNearMe",
  description: "Read-only AI admin assistant for SalahNearMe.",
};

export default function AdminAIAssistantPage() {
  return (
    <AdminGate>
      <AdminAIAssistant />
    </AdminGate>
  );
}

