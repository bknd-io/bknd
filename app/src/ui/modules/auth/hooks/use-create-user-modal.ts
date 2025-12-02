import { useApi, useInvalidate } from "bknd/client";
import { useBkndAuth } from "ui/client/schema/auth/use-bknd-auth";
import { routes, useNavigate } from "ui/lib/routes";
import { bkndModals } from "ui/modals";

export function useCreateUserModal() {
   const api = useApi();
   const { config } = useBkndAuth();
   const invalidate = useInvalidate();
   const [navigate] = useNavigate();

   const open = async () => {
      const loading = bkndModals.open("overlay", {
         content: "Loading...",
      });

      const schema = await api.auth.actionSchema("password", "create");
      loading.closeAll(); // currently can't close by id...

      bkndModals.open(
         "form",
         {
            schema,
            uiSchema: {
               password: {
                  "ui:widget": "password",
               },
            },
            autoCloseAfterSubmit: false,
            onSubmit: async (data, ctx) => {
               console.log("submitted:", data, ctx);
               const res = await api.auth.action("password", "create", data);
               console.log(res);
               if (res.ok) {
                  // invalidate all data
                  invalidate();
                  navigate(routes.data.entity.edit(config.entity_name, res.data.id));
                  ctx.close();
               } else if ("error" in res) {
                  ctx.setError(res.error);
               } else {
                  ctx.setError("Unknown error");
               }
            },
         },
         {
            title: "Create User",
         },
      );
   };

   return { open };
}
