import {
   type ChangeEvent,
   type ComponentPropsWithoutRef,
   type FormEvent,
   useEffect,
   useRef,
   useState,
} from "react";
import { useEvent } from "ui/hooks/use-event";
import {
   type CleanOptions,
   type InputElement,
   cleanObject,
   coerce,
   getFormTarget,
   getTargetsByName,
   setPath,
} from "./utils";

export type NativeFormProps = {
   hiddenSubmit?: boolean;
   validateOn?: "change" | "submit";
   errorFieldSelector?: <K extends keyof HTMLElementTagNameMap>(name: string) => any | null;
   reportValidity?: boolean;
   onSubmit?: (data: any, ctx: { event: FormEvent<HTMLFormElement> }) => Promise<void> | void;
   onSubmitInvalid?: (
      errors: InputError[],
      ctx: { event: FormEvent<HTMLFormElement> },
   ) => Promise<void> | void;
   onError?: (errors: InputError[]) => void;
   disableSubmitOnError?: boolean;
   onChange?: (
      data: any,
      ctx: { event: ChangeEvent<HTMLFormElement>; key: string; value: any; errors: InputError[] },
   ) => Promise<void> | void;
   clean?: CleanOptions | true;
} & Omit<ComponentPropsWithoutRef<"form">, "onChange" | "onSubmit">;

export type InputError = {
   name: string;
   message: string;
};

export function NativeForm({
   children,
   validateOn = "submit",
   hiddenSubmit = false,
   errorFieldSelector,
   reportValidity,
   onSubmit,
   onSubmitInvalid,
   onError,
   clean,
   disableSubmitOnError = true,
   ...props
}: NativeFormProps) {
   const formRef = useRef<HTMLFormElement>(null);
   const [errors, setErrors] = useState<InputError[]>([]);

   useEffect(() => {
      if (!formRef.current || props.noValidate) return;
      validate();
   }, []);

   useEffect(() => {
      if (!formRef.current || props.noValidate) return;

      // find submit buttons and disable them if there are errors
      const invalid = errors.length > 0;
      formRef.current.querySelectorAll("[type=submit]").forEach((submit) => {
         if (!submit || !("type" in submit) || submit.type !== "submit") return;
         // @ts-ignore
         submit.disabled = invalid;
      });

      onError?.(errors);
   }, [errors]);

   const validateElement = (el: InputElement | null, opts?: { report?: boolean }) => {
      if (props.noValidate || !el || !("name" in el)) return;
      const errorElement = formRef.current?.querySelector(
         errorFieldSelector?.(el.name) ?? `[data-role="input-error"][data-name="${el.name}"]`,
      );

      if (!el.checkValidity()) {
         const error = {
            name: el.name,
            message: el.validationMessage,
         };

         setErrors((prev) => [...prev.filter((e) => e.name !== el.name), error]);
         if (opts?.report) {
            if (errorElement) {
               errorElement.textContent = error.message;
            } else if (reportValidity) {
               el.reportValidity();
            }
         }

         return error;
      } else {
         setErrors((prev) => prev.filter((e) => e.name !== el.name));
         if (errorElement) {
            errorElement.textContent = "";
         }
      }

      return;
   };

   const validate = (opts?: { report?: boolean }) => {
      if (!formRef.current || props.noValidate) return [];

      const errors: InputError[] = [];
      formRef.current.querySelectorAll("input, select, textarea").forEach((e) => {
         const el = e as InputElement | null;
         const error = validateElement(el, opts);
         if (error) {
            errors.push(error);
         }
      });

      if (disableSubmitOnError) {
         formRef.current.querySelectorAll("[type=submit]").forEach((submit) => {
            if (errors.length > 0) {
               submit.setAttribute("disabled", "disabled");
            } else {
               submit.removeAttribute("disabled");
            }
         });
      }

      return errors;
   };

   const getFormValues = () => {
      if (!formRef.current) return {};

      const formData = new FormData(formRef.current);
      const obj: any = {};
      formData.forEach((value, key) => {
         const targets = getTargetsByName(formRef.current!, key);
         if (targets.length === 0) {
            console.warn(`No target found for key: ${key}`);
            return;
         }

         const count = targets.length;
         const multiple = count > 1;
         targets.forEach((target, index) => {
            let _key = key;

            if (multiple) {
               _key = `${key}[${index}]`;
            }

            setPath(obj, _key, coerce(target, target.value));
         });
      });

      if (typeof clean === "undefined") return obj;
      return cleanObject(obj, clean === true ? undefined : clean);
   };

   const handleChange = async (e: ChangeEvent<HTMLFormElement>) => {
      const form = formRef.current;
      if (!form) return;
      const target = getFormTarget(e);
      if (!target) return;

      if (validateOn === "change" || errors.length > 0) {
         validateElement(target, { report: true });
      }

      if (props.onChange) {
         await props.onChange(getFormValues(), {
            event: e,
            key: target.name,
            value: target.value,
            errors,
         });
      }
   };

   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = formRef.current;
      if (!form) return;

      const errors = validate({ report: true });
      if (errors.length > 0) {
         onSubmitInvalid?.(errors, { event: e });
         return;
      }

      if (onSubmit) {
         await onSubmit(getFormValues(), { event: e });
      } else {
         form.submit();
      }
   };

   const handleKeyDown = (e: KeyboardEvent) => {
      if (!formRef.current) return;

      // if is enter key, submit is disabled, report errors
      if (e.keyCode === 13) {
         const invalid = errors.length > 0;
         if (invalid && !props.noValidate && reportValidity) {
            formRef.current.reportValidity();
         }
      }
   };

   return (
      <form
         {...props}
         onChange={handleChange}
         onSubmit={handleSubmit}
         ref={formRef}
         onKeyDown={handleKeyDown as any}
      >
         {children}
         {hiddenSubmit && <input type="submit" style={{ visibility: "hidden" }} />}
      </form>
   );
}
