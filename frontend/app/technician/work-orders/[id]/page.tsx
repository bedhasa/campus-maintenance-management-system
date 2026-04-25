import WorkOrderDetailPage from "../../../../pages/Technician/WorkOrderDetailPage";

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkOrderDetailPage id={id} />;
}
