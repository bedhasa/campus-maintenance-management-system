"use client";

import TaskCollectionPage from "./TaskCollectionPage";

export default function InProgressPage() {
  return (
    <TaskCollectionPage
      title="In Progress"
      subtitle="Track active work, add progress updates, report delays, and finish jobs cleanly."
      query="status=active"
      emptyTitle="No active jobs"
      emptyCopy="Start one of your assigned tasks to move it into the in-progress queue."
    />
  );
}
