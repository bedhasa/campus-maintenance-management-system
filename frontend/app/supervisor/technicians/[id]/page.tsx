import TechnicianProfilePage from "../../../../pages/Supervisor/TechnicianProfilePage";

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TechnicianProfilePage id={id} />;
}
