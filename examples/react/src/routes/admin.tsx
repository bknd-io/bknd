import { Admin, type BkndAdminProps } from "bknd/ui";
import "bknd/dist/styles.css";

export default function AdminPage(props: BkndAdminProps) {
   return <Admin {...props} />;
}
