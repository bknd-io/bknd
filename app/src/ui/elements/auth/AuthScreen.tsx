import { isValidElement, type ReactNode } from "react";
import { useAuthStrategies } from "../hooks/use-auth";
import { AuthForm } from "./AuthForm";

export type AuthScreenProps = {
   method?: "POST" | "GET";
   action?: "login" | "register";
   logo?: ReactNode;
   intro?: ReactNode;
   formOnly?: boolean;
};

export function AuthScreen({
   method = "POST",
   action = "login",
   logo,
   intro,
   formOnly,
}: AuthScreenProps) {
   const { strategies, basepath, loading } = useAuthStrategies();
   const Form = <AuthForm auth={{ basepath, strategies }} method={method} action={action} />;

   if (formOnly) {
      if (loading) return null;
      return Form;
   }

   return (
      <div className="flex flex-1 flex-col select-none h-dvh w-dvw justify-center items-center bknd-admin">
         {!loading && (
            <div className="flex flex-col gap-4 items-center w-96 px-6 py-7">
               {logo ? logo : null}
               {isValidElement(intro) ? (
                  intro
               ) : (
                  <div className="flex flex-col items-center">
                     <h1 className="text-xl font-bold">
                        Sign {action === "login" ? "in" : "up"} to your admin panel
                     </h1>
                     <p className="text-primary/50">Enter your credentials below to get access.</p>
                  </div>
               )}
               {Form}
            </div>
         )}
      </div>
   );
}
