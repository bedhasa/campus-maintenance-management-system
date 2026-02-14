"use client";

import RequestDetailPage from "../../../../pages/Supervisor/RequestDetailPage";

export default function RoutePage({ params }: { params: { id: string } }) {
  return <RequestDetailPage id={params.id} />;
}

