import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "bknd/client";
import "bknd/dist/styles.css";
import { Admin } from "bknd/ui";

export const Route = createFileRoute("/admin/$")({
  ssr: false,
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth();
  return (
    <Admin
      withProvider={{ user: user }}
      config={{
        basepath: "/admin",
        logo_return_path: "/../",
      }}
      baseUrl={import.meta.env.APP_URL}
    />
  );
}
