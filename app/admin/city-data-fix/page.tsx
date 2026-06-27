import type { Metadata } from "next";
import AdminGate from "@/components/AdminGate";
import CityDataFixClient from "./city-data-fix-client";

export const metadata: Metadata = {
  title: "City Data Fix | SalahNearMe",
};

export default function CityDataFixPage() {
  return (
    <AdminGate>
      <CityDataFixClient />
    </AdminGate>
  );
}

