import type { Metadata } from "next";
import AdminGate from "@/components/AdminGate";
import CityLaunchReadinessClient from "./readiness-client";

export const metadata: Metadata = {
  title: "City Launch Readiness | SalahNearMe",
};

export default function CityLaunchReadinessPage() {
  return (
    <AdminGate>
      <CityLaunchReadinessClient />
    </AdminGate>
  );
}

