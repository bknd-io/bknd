import { useInsertionEffect, useRef } from "react";
import { type LinkProps, Link as WouterLink, useRoute, useRouter } from "wouter";
import { useEvent } from "../../hooks/use-event";

/*
 * Transforms `path` into its relative `base` version
 * If base isn't part of the path provided returns absolute path e.g. `~/app`
 */
export const relativePath = (base = "", path = "") =>
   !path.toLowerCase().indexOf(base.toLowerCase()) ? path.slice(base.length) || "/" : "~" + path;

export const absolutePath = (to, base = "") => (to[0] === "~" ? to.slice(1) : base + to);

/*
 * Removes leading question mark
 */
export const stripQm = (str) => (str[0] === "?" ? str.slice(1) : str);

/*
 * decodes escape sequences such as %20
 */

// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
export const unescape = (str) => {
   try {
      return decodeURI(str);
   } catch (_e) {
      // fail-safe mode: if string can't be decoded do nothing
      return str;
   }
};

const useLocationFromRouter = (router) => {
   const [location, navigate] = router.hook(router);

   // the function reference should stay the same between re-renders, so that
   // it can be passed down as an element prop without any performance concerns.
   // (This is achieved via `useEvent`.)
   return [
      unescape(relativePath(router.base, location)),
      useEvent((to, navOpts) => navigate(absolutePath(to, router.base), navOpts)),
   ];
};

export function isLinkActive(href: string, strictness?: number) {
   const path = window.location.pathname;

   if (!strictness || strictness === 0) {
      return path.includes(href);
   } else if (strictness === 1) {
      return path === href || path.endsWith(href) || path.includes(href + "/");
   }

   return path === href;
}

export function Link({
   className,
   native,
   onClick,
   ...props
}: { className?: string; native?: boolean; transition?: boolean } & LinkProps) {
   const router = useRouter();
   const [path, navigate] = useLocationFromRouter(router);

   function isActive(absPath: string, href: string) {
      if (absPath.startsWith(href)) {
         const l = absPath.replace(href, "");
         return l.length === 0 || l[0] === "/";
      }

      return false;
   }

   const _href = props.href ?? props.to;
   const href = router
      .hrefs(
         _href[0] === "~" ? _href.slice(1) : router.base + _href,
         router, // pass router as a second argument for convinience
      )
      .replace("//", "/");
   const absPath = absolutePath(path, router.base).replace("//", "/");
   const active =
      href.replace(router.base, "").length <= 1 ? href === absPath : isActive(absPath, href);

   if (native) {
      return <a className={`${active ? "active " : ""}${className}`} {...props} />;
   }

   const wouterOnClick = (e: any) => {
      onClick?.(e);
      // prepared for view transition
      /*if (props.transition !== false) {
         e.preventDefault();
         onClick?.(e);
         document.startViewTransition(() => {
            navigate(props.href ?? props.to, props);
         });
      }*/
   };

   return (
      <WouterLink
         // @ts-expect-error className is not typed on WouterLink
         className={`${active ? "active " : ""}${className}`}
         {...props}
         onClick={wouterOnClick}
      />
   );
}
