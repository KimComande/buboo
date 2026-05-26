import AdminDashboardClient from "@/components/admin/AdminDashboardClient.jsx";

export default async function AdminPage({ searchParams }) {
  const params = await searchParams;
  const slug = String(params?.event ?? "demo");
  return <AdminDashboardClient initialSlug={slug} />;
}
