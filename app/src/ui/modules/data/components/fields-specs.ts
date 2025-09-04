import {
   TbBraces,
   TbCalendar,
   TbCirclesRelation,
   TbCodePlus,
   TbNumber123,
   TbPhoto,
   TbSelector,
   TbTextCaption,
   TbToggleLeft,
   TbKey,
   TbSettings,
} from "react-icons/tb";

export type TFieldSpec = {
   type: string;
   label: string;
   icon: any;
   addable?: boolean;
   disabled?: string[];
   hidden?: string[];
   customBehavior?: {
      showCustomIndicator?: boolean;
      customIcon?: any;
      customLabel?: string;
   };
};

export const fieldSpecs: TFieldSpec[] = [
   {
      type: "primary",
      label: "Primary",
      icon: TbKey,
      addable: false,
      disabled: ["name"],
      hidden: ["virtual"],
      customBehavior: {
         showCustomIndicator: true,
         customIcon: TbSettings,
         customLabel: "Custom ID",
      },
   },
   {
      type: "text",
      label: "Text",
      icon: TbTextCaption,
   },
   {
      type: "number",
      label: "Number",
      icon: TbNumber123,
   },
   {
      type: "boolean",
      label: "Boolean",
      icon: TbToggleLeft,
   },
   {
      type: "date",
      label: "Date",
      icon: TbCalendar,
   },
   {
      type: "enum",
      label: "Enum",
      icon: TbSelector,
   },
   {
      type: "json",
      label: "JSON",
      icon: TbBraces,
   },
   {
      type: "jsonschema",
      label: "JSON Schema",
      icon: TbCodePlus,
   },
   {
      type: "relation",
      label: "Relation",
      icon: TbCirclesRelation,
      addable: false,
      hidden: ["virtual"],
   },
   {
      type: "media",
      label: "Media",
      icon: TbPhoto,
      addable: false,
      hidden: ["virtual"],
   },
];
