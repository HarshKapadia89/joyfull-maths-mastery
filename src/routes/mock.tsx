import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/mock")({
  component: () => <Navigate to="/custom" replace />,
});
