"use client";

import TechnicianProfilePage from "../../../../pages/Supervisor/TechnicianProfilePage";

export default function RoutePage({ params }: { params: { id: string } }) {
  return <TechnicianProfilePage id={params.id} />;
}

