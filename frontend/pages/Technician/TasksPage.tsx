"use client";

import TaskCollectionPage from "./TaskCollectionPage";

export default function TasksPage() {
  return (
    <TaskCollectionPage
      title="My Tasks"
      subtitle="View and manage your assigned work orders."
      query="status=open"
      emptyTitle="No tasks assigned"
      emptyCopy="Once the supervisor assigns a work order, it will appear here."
    />
  );
}
