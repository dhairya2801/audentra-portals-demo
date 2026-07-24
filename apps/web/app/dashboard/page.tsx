import type { Metadata } from "next";
import { StudentDashboardPage } from "../student-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your Aster University enrollment dashboard.",
};

export default function DashboardPage() {
  return <StudentDashboardPage />;
}
