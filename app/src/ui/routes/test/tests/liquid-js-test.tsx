import { TextInput } from "@mantine/core";
import * as Formy from "../../../components/form/Formy";
import { HtmlEditor } from "ui/components/code/HtmlEditor";

export function LiquidJsTest() {
   return (
      <div className="flex flex-col p-4 gap-3">
         <h1>LiquidJsTest</h1>
         <HtmlEditor />

         <TextInput />
         <Formy.Input />
      </div>
   );
}
