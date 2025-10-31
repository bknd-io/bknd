import { useState } from "react";
import { JsonEditor } from "ui/components/code/JsonEditor";
import { JsonViewer } from "ui/components/code/JsonViewer";

export default function CodeEditorTest() {
   const [value, setValue] = useState({});
   return (
      <div className="flex flex-col p-4">
         <JsonEditor value={value} onChange={setValue} />
         <JsonViewer json={value} expand={9} />
      </div>
   );
}
