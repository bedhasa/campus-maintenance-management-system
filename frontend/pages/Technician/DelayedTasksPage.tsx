"use client";

import TaskCollectionPage from "./TaskCollectionPage";

export default function DelayedTasksPage() {
  return (
    <TaskCollectionPage
      title="Delayed Tasks"
      subtitle="Keep overdue jobs and reported delays visible so you can communicate and recover fast."
      query="filter=delayed"
      emptyTitle="No delayed tasks"
      emptyCopy="If a task becomes overdue or you report a delay, it will appear here."
    />
  );
}
