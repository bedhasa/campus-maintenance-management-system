import RequestDetailPage from "../../../../pages/Supervisor/RequestDetailPage";

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetailPage id={id} />;
}
