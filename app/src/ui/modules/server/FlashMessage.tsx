import { getFlashMessage } from "core/server/flash";
import { useEffect, useState } from "react";
import { Alert } from "ui/components/display/Alert";

/**
 * Handles flash message from server
 * @constructor
 */
export function FlashMessage() {
   const [flash, setFlash] = useState<ReturnType<typeof getFlashMessage>>();

   useEffect(() => {
      if (!flash) {
         const content = getFlashMessage();
         if (content) {
            setFlash(content);
         }
      }
   }, []);

   if (flash) {
      let Component = Alert.Info;
      switch (flash.type) {
         case "error":
            Component = Alert.Exception;
            break;
         case "success":
            Component = Alert.Success;
            break;
         case "warning":
            Component = Alert.Warning;
            break;
      }

      return <Component message={flash.message} className="justify-center" />;
   }

   return null;
}
