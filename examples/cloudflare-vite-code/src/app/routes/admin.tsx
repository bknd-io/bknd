import { Admin, type BkndAdminProps } from "bknd/ui";
import "bknd/dist/styles.css";
import { useAuth } from "bknd/client";

export default function AdminPage(props: BkndAdminProps) {
   const auth = useAuth();
   return <Admin {...props} withProvider={{ user: auth.user }} />;
}
