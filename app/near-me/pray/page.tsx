import PrayNearMeClient from "@/components/PrayNearMeClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pray Near Me | SalahNearMe",
  description:
    "Find the best nearby mosque to pray now using distance, mosque timetable, live status, and facilities.",
};

export default function PrayNearMePage() {
  return <PrayNearMeClient />;
}

