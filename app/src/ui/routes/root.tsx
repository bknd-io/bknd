import { IconHome } from "@tabler/icons-react";
import { useEffect } from "react";
import { useAuth } from "bknd/client";
import { useEffectOnce } from "ui/hooks/use-effect";
import { Empty } from "../components/display/Empty";
import { useBrowserTitle } from "../hooks/use-browser-title";
import * as AppShell from "../layouts/AppShell/AppShell";
import { useNavigate } from "../lib/routes";

export const Root = ({ children }) => {
   const { verify, user } = useAuth();

   useEffectOnce(() => {
      verify();
   }, [user?.id]);

   return (
      <AppShell.Root>
         <AppShell.Header />
         <AppShell.Content>{children}</AppShell.Content>
      </AppShell.Root>
   );
};

export function RootEmpty() {
   const [navigate] = useNavigate();
   useEffect(() => {
      navigate("/data");
   }, []);

   useBrowserTitle();
   return (
      <Empty
         Icon={IconHome}
         title="Not implemented yet"
         description={`Go checkout "Data" or "Media" for some action.`}
      />
   );
}
