import { useMemo } from "react";
import { TbArrowLeft, TbDots } from "react-icons/tb";
import { Link, useLocation } from "wouter";
import { IconButton } from "../../components/buttons/IconButton";
import { Dropdown } from "../../components/overlay/Dropdown";
import { useEvent } from "../../hooks/use-event";
import { useNavigate } from "ui/lib/routes";

type Breadcrumb = {
   label: string | Element;
   onClick?: () => void;
   href?: string;
};
export type Breadcrumbs2Props = {
   path: Breadcrumb[];
   backTo?: string;
   onBack?: () => void;
};

export const Breadcrumbs2 = ({ path: _path, backTo, onBack }: Breadcrumbs2Props) => {
   const [, , _goBack] = useNavigate();
   const path = Array.isArray(_path) ? _path : [_path];
   const hasBack = path.length > 1;

   const goBack = onBack ? onBack : () => _goBack({ fallback: backTo });

   const crumbs = useMemo(
      () =>
         path.map((p, key) => {
            const last = key === path.length - 1;

            return {
               last,
               ...p,
            };
         }),
      [path],
   );

   return (
      <div className="flex flex-row flex-grow items-center gap-2 text-lg">
         {hasBack && (
            <IconButton
               onClick={goBack}
               Icon={TbArrowLeft}
               variant="default"
               size="lg"
               className="mr-1"
            />
         )}
         <div className="hidden md:flex gap-1.5">
            <CrumbsDesktop crumbs={crumbs} />
         </div>
         <div className="flex md:hidden gap-2">{<CrumbsMobile crumbs={crumbs} />}</div>
      </div>
   );
};

const CrumbsDesktop = ({ crumbs }) => {
   return crumbs.map((crumb, key) => {
      return crumb.last ? <CrumbLast key={key} {...crumb} /> : <CrumbLink key={key} {...crumb} />;
   });
};

const CrumbsMobile = ({ crumbs }) => {
   const [, navigate] = useLocation();
   if (crumbs.length <= 2) return <CrumbsDesktop crumbs={crumbs} />;
   const first = crumbs[0];
   const last = crumbs[crumbs.length - 1];
   const items = useMemo(
      () =>
         crumbs.slice(1, -1).map((c) => ({
            label: c.string,
            href: c.href,
         })),
      [crumbs],
   );
   const onClick = useEvent((item) => navigate(`~/${item.href}`));

   return (
      <>
         <CrumbLink {...first} />
         <Dropdown onClickItem={onClick} items={items}>
            <IconButton Icon={TbDots} variant="ghost" />
         </Dropdown>
         <span className="opacity-25 dark:font-bold font-semibold">/</span>
         <CrumbLast {...last} />
      </>
   );
};

const CrumbLast = ({ label }) => {
   return <span className="text-nowrap dark:font-bold font-semibold">{label}</span>;
};

const CrumbLink = ({ href, label }) => {
   return (
      <div className="opacity-50 flex flex-row gap-1.5 dark:font-bold font-semibold">
         <Link to={href} className="text-nowrap">
            {label}
         </Link>
         <span className="opacity-50">/</span>
      </div>
   );
};
