import clsx from "clsx";
import { TbArrowRight, TbCircle, TbCircleCheckFilled, TbFingerprint } from "react-icons/tb";
import { useApiQuery } from "bknd/client";
import { useBknd } from "ui/client/bknd";
import { useBkndAuth } from "ui/client/schema/auth/use-bknd-auth";
import { ButtonLink, type ButtonLinkProps } from "ui/components/buttons/Button";
import { IconButton } from "ui/components/buttons/IconButton";
import { Alert } from "ui/components/display/Alert";
import * as AppShell from "ui/layouts/AppShell/AppShell";
import { routes, useNavigate } from "ui/lib/routes";

export function AuthIndex() {
   const { app } = useBknd();
   const {
      config: { roles, strategies, entity_name, enabled },
   } = useBkndAuth();
   const users_entity = entity_name;
   const $q = useApiQuery((api) => api.data.count(users_entity), {
      enabled,
   });
   const usersTotal = $q.data?.count ?? 0;
   const rolesTotal = Object.keys(roles ?? {}).length ?? 0;
   const strategiesTotal = Object.keys(strategies ?? {}).length ?? 0;

   const usersLink = app.getAbsolutePath("/data/" + routes.data.entity.list(users_entity));
   const rolesLink = routes.auth.roles.list();
   const strategiesLink = routes.auth.strategies();

   return (
      <>
         <AppShell.SectionHeader>Overview</AppShell.SectionHeader>
         <AppShell.Scrollable>
            <Alert.Warning
               visible={!enabled}
               title="Auth not enabled"
               message="To use authentication features, please enable it in the settings."
            />
            <div className="flex flex-col md:flex-row flex-1 p-3 gap-3">
               <div className="flex flex-col border border-primary/20 self-stretch md:self-start">
                  <div className="flex flex-row gap-3 py-3 px-4 border-b border-b-muted font-medium bg-muted items-center justify-between">
                     Getting started
                     <TbFingerprint className="size-5" />
                  </div>
                  <Item title="Enable authentication" done={enabled} to={routes.auth.settings()} />
                  <Item title="Create Roles" done={rolesTotal > 0} to={rolesLink} />
                  <Item title="Create an user" done={usersTotal > 0} to={usersLink} />
                  <Item
                     title="Enable a second strategy"
                     done={strategiesTotal > 1}
                     to={strategiesLink}
                  />
               </div>
               <div className="grid xs:grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 flex-grow">
                  <KpiCard
                     title="Users registered"
                     value={!enabled ? 0 : usersTotal}
                     actions={[
                        {
                           label: "View all",
                           href: usersLink,
                        },
                        { label: "Add new", variant: "default", href: usersLink },
                     ]}
                  />
                  <KpiCard
                     title="Roles"
                     value={!enabled ? 0 : rolesTotal}
                     actions={[
                        { label: "View all", href: rolesLink },
                        { label: "Manage", variant: "default", href: rolesLink },
                     ]}
                  />
                  <KpiCard
                     title="Strategies enabled"
                     value={!enabled ? 0 : strategiesTotal}
                     actions={[
                        { label: "View all", href: strategiesLink },
                        { label: "Manage", variant: "default", href: strategiesLink },
                     ]}
                  />
               </div>
            </div>
         </AppShell.Scrollable>
      </>
   );
}

type KpiCardProps = {
   title: string;
   value: number;
   actions: (Omit<ButtonLinkProps, "href"> & { label: string; href?: string })[];
};

const KpiCard: React.FC<KpiCardProps> = ({ title, value, actions }) => (
   <div className="flex flex-col border border-muted h-auto self-start">
      <div className="flex flex-col gap-2 px-5 pt-3.5 pb-4 border-b border-b-muted">
         <div>
            <span className="opacity-50">{title}</span>
            {/*<span>+6.1%</span>*/}
         </div>
         <div className="text-4xl font-medium">{value}</div>
      </div>
      <div className="flex flex-row gap-3 p-3 justify-between">
         {actions.map((action, i) => (
            <ButtonLink key={i} size="small" variant="ghost" href="#" {...action}>
               {action.label}
            </ButtonLink>
         ))}
      </div>
   </div>
);

const Item = ({ title, done = false, to }: { title: string; done?: boolean; to?: string }) => {
   const [navigate] = useNavigate();
   return (
      <div className="flex border-b border-b-muted">
         <div className={clsx("flex flex-1 flex-row gap-3 py-3 px-4", done && "opacity-50")}>
            <div className="flex flex-row flex-1 gap-3 items-center">
               {done ? <TbCircleCheckFilled className="size-5" /> : <TbCircle className="size-5" />}
               <p
                  className={clsx(
                     "font-medium text-primary/80 leading-none",
                     done ? "line-through" : "",
                  )}
               >
                  {title}
               </p>
            </div>
            {to && <IconButton Icon={TbArrowRight} onClick={() => navigate(to)} />}
         </div>
      </div>
   );
};
