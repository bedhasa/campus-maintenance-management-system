"use client";

import TaskCollectionPage from "./TaskCollectionPage";

export default function CompletedPage() {
  return (
    <TaskCollectionPage
      title="Completed Tasks"
      subtitle="Review finished work orders, completion notes, and uploaded evidence."
      query="status=completed"
      emptyTitle="No completed work yet"
      emptyCopy="Completed tasks will move here once you finish and submit them."
    />
  );
}
