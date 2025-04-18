import {
   type BaseInputTemplateProps,
   type FormContextType,
   type RJSFSchema,
   type StrictRJSFSchema,
   ariaDescribedByIds,
   examplesId,
   getInputProps,
} from "@rjsf/utils";
import { type ChangeEvent, type FocusEvent, useCallback } from "react";
import { Label } from "./FieldTemplate";

/** The `BaseInputTemplate` is the template to use to render the basic `<input>` component for the `core` theme.
 * It is used as the template for rendering many of the <input> based widgets that differ by `type` and callbacks only.
 * It can be customized/overridden for other themes or individual implementations as needed.
 *
 * @param props - The `WidgetProps` for this template
 */
export default function BaseInputTemplate<
   T = any,
   S extends StrictRJSFSchema = RJSFSchema,
   F extends FormContextType = any,
>(props: BaseInputTemplateProps<T, S, F>) {
   const {
      id,
      name, // remove this from ...rest
      value,
      readonly,
      disabled,
      autofocus,
      onBlur,
      onFocus,
      onChange,
      onChangeOverride,
      options,
      schema,
      uiSchema,
      formContext,
      registry,
      rawErrors,
      type,
      hideLabel, // remove this from ...rest
      hideError, // remove this from ...rest
      ...rest
   } = props;

   // Note: since React 15.2.0 we can't forward unknown element attributes, so we
   // exclude the "options" and "schema" ones here.
   if (!id) {
      console.log("No id for", props);
      throw new Error(`no id for props ${JSON.stringify(props)}`);
   }
   const inputProps = {
      ...rest,
      ...getInputProps<T, S, F>(schema, type, options),
   };

   let inputValue: any;
   if (inputProps.type === "number" || inputProps.type === "integer") {
      inputValue = value || value === 0 ? value : "";
   } else {
      inputValue = value == null ? "" : value;
   }

   const _onChange = useCallback(
      ({ target: { value } }: ChangeEvent<HTMLInputElement>) =>
         onChange(value === "" ? options.emptyValue : value),
      [onChange, options],
   );
   const _onBlur = useCallback(
      ({ target }: FocusEvent<HTMLInputElement>) => onBlur(id, target?.value),
      [onBlur, id],
   );
   const _onFocus = useCallback(
      ({ target }: FocusEvent<HTMLInputElement>) => onFocus(id, target?.value),
      [onFocus, id],
   );

   const shouldHideLabel =
      !props.label ||
      // @ts-ignore
      uiSchema["ui:options"]?.hideLabel ||
      props.options?.hideLabel ||
      props.hideLabel;

   return (
      <>
         {!shouldHideLabel && <Label label={props.label} required={props.required} id={id} />}
         <input
            id={id}
            name={id}
            className="form-control"
            readOnly={readonly}
            disabled={disabled}
            autoFocus={autofocus}
            value={inputValue}
            {...inputProps}
            placeholder={props.label}
            list={schema.examples ? examplesId<T>(id) : undefined}
            onChange={onChangeOverride || _onChange}
            onBlur={_onBlur}
            onFocus={_onFocus}
            aria-describedby={ariaDescribedByIds<T>(id, !!schema.examples)}
         />
         {Array.isArray(schema.examples) && (
            <datalist key={`datalist_${id}`} id={examplesId<T>(id)}>
               {(schema.examples as string[])
                  .concat(
                     schema.default && !schema.examples.includes(schema.default)
                        ? ([schema.default] as string[])
                        : [],
                  )
                  .map((example: any) => {
                     return <option key={example} value={example} />;
                  })}
            </datalist>
         )}
      </>
   );
}
