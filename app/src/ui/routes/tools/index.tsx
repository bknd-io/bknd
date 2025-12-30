import { Empty } from "ui/components/display/Empty";
import { Route } from "wouter";
import ToolsMcp from "./mcp/mcp";

export default function ToolsRoutes() {
   return (
      <>
         <Route path="/" component={ToolsIndex} />
         <Route path="/mcp" component={ToolsMcp} />
      </>
   );
}

function ToolsIndex() {
   return <Empty title="Tools" description="Select a tool to continue." />;
}
