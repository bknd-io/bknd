import { AppFlows } from "flows/AppFlows";
import { useState } from "react";
import { JsonViewer } from "../../../components/code/JsonViewer";
import { JsonSchemaForm } from "../../../components/form/json-schema";
import { Scrollable } from "../../../layouts/AppShell/AppShell";
import { parse } from "bknd/utils";

export default function FlowCreateSchemaTest() {
   //const schema = flowsConfigSchema;
   const schema = new AppFlows().getSchema();
   const [data, setData] = useState(parse(schema, {}));

   return (
      <Scrollable>
         <div className="flex flex-col p-3">
            <JsonSchemaForm
               schema={schema}
               onChange={setData}
               className="legacy hide-required-mark"
            />
         </div>
         <JsonViewer json={data} expand={9} />
      </Scrollable>
   );
}
