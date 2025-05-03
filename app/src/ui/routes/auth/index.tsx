import { Route } from "wouter";
import { AuthRoot } from "./_auth.root";
import { AuthIndex } from "./auth.index";
import { AuthRolesList } from "./auth.roles";
import { AuthRolesEdit } from "./auth.roles.edit.$role";
import { AuthSettings } from "./auth.settings";
import { AuthStrategiesList } from "./auth.strategies";
import { AuthUsersList } from "./auth.users";

export default function AuthRoutes() {
   return (
      <AuthRoot>
         <Route path="/" component={AuthIndex} />
         <Route path="/users" component={AuthUsersList} />
         <Route path="/roles" component={AuthRolesList} />
         <Route path="/roles/edit/:role" component={AuthRolesEdit} />
         <Route path="/strategies/:strategy?" component={AuthStrategiesList} />
         <Route path="/settings" component={AuthSettings} />
      </AuthRoot>
   );
}
