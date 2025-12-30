import { twMerge } from "tailwind-merge";
import { Button, type ButtonProps } from "../buttons/Button";

export type EmptyProps = {
   Icon?: any;
   title?: string;
   description?: string;
   primary?: ButtonProps;
   secondary?: ButtonProps;
   className?: string;
   children?: React.ReactNode;
};
export const Empty: React.FC<EmptyProps> = ({
   Icon = undefined,
   title = undefined,
   description = "Check back later my friend.",
   primary,
   secondary,
   className,
   children,
}) => (
   <div className={twMerge("flex flex-col h-full w-full justify-center items-center", className)}>
      <div className="flex flex-col gap-3 items-center max-w-80">
         {Icon && <Icon size={48} className="opacity-50" stroke={1} />}
         <div className="flex flex-col gap-1">
            {title && <h3 className="text-center text-lg font-bold">{title}</h3>}
            <p className="text-center text-primary/60">{description}</p>
         </div>
         <div className="mt-1.5 flex flex-row gap-2">
            {secondary && <Button variant="default" {...secondary} />}
            {primary && <Button variant="primary" {...primary} />}
            {children}
         </div>
      </div>
   </div>
);
