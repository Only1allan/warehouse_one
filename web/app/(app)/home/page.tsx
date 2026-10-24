import { HomeDashboard } from "@/components/home-dashboard";
import { PageHeader } from "@/components/ui";

export default function HomePage() {
  return (
    <>
      <PageHeader title="Home" description="What needs doing on this shift." />
      <HomeDashboard />
    </>
  );
}
