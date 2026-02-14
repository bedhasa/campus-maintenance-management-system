"use client";

import WorkOrderDetailPage from "../../../../pages/Supervisor/WorkOrderDetailPage";

export default function RoutePage({ params }: { params: { id: string } }) {
  return <WorkOrderDetailPage id={params.id} />;
}

