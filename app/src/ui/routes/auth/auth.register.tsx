import { Logo } from "ui/components/display/Logo";
import { Link } from "ui/components/wouter/Link";
import { Auth } from "ui/elements";
import { useBrowserTitle } from "ui/hooks/use-browser-title";

export function AuthRegister() {
   useBrowserTitle(["Register"]);
   return (
      <Auth.Screen
         action="register"
         logo={
            <Link href={"/"} className="link">
               <Logo scale={0.25} />
            </Link>
         }
      />
   );
}
