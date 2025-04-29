import JsonField from "./JsonField";
import MultiSchemaField from "./MultiSchemaField";
import HtmlField from "./HtmlField";

export const fields = {
   AnyOfField: MultiSchemaField,
   OneOfField: MultiSchemaField,
   JsonField,
   HtmlField,
};
