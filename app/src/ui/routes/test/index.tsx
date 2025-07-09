import AppShellAccordionsTest from "ui/routes/test/tests/appshell-accordions-test";

import FormyTest from "ui/routes/test/tests/formy-test";
import HtmlFormTest from "ui/routes/test/tests/html-form-test";
import SwaggerTest from "ui/routes/test/tests/swagger-test";
import SWRAndAPI from "ui/routes/test/tests/swr-and-api";
import SwrAndDataApi from "ui/routes/test/tests/swr-and-data-api";
import { Route, useParams } from "wouter";
import { Empty } from "../../components/display/Empty";
import { Link } from "../../components/wouter/Link";
import { AppShell } from "../../layouts/AppShell";
import FlowCreateSchemaTest from "../../routes/test/tests/flow-create-schema-test";
import FlowFormTest from "../../routes/test/tests/flow-form-test";
import ModalTest from "../../routes/test/tests/modal-test";
import QueryJsonFormTest from "../../routes/test/tests/query-jsonform";
import DropdownTest from "./tests/dropdown-test";
import DropzoneElementTest from "./tests/dropzone-element-test";
import FlowsTest from "./tests/flows-test";
import JsonSchemaForm3 from "./tests/json-schema-form3";
import JsonFormTest from "./tests/jsonform-test";
import { LiquidJsTest } from "./tests/liquid-js-test";
import MantineTest from "./tests/mantine-test";
import ReactHookErrors from "./tests/react-hook-errors";
import ReactFlowTest from "./tests/reactflow-test";
import SchemaTest from "./tests/schema-test";
import SortableTest from "./tests/sortable-test";
import { SqlAiTest } from "./tests/sql-ai-test";
import Themes from "./tests/themes";

const tests = {
   DropdownTest,
   Themes,
   ModalTest,
   JsonFormTest,
   FlowFormTest,
   QueryJsonFormTest,
   FlowCreateSchemaTest,
   ReactFlowTest,
   SchemaTest,
   MantineTest,
   LiquidJsTest,
   SqlAiTest,
   SortableTest,
   ReactHookErrors,
   FlowsTest,
   AppShellAccordionsTest,
   SwaggerTest,
   SWRAndAPI,
   SwrAndDataApi,
   DropzoneElementTest,
   JsonSchemaForm3,
   FormyTest,
   HtmlFormTest,
} as const;

export default function TestRoutes() {
   return (
      <TestRoot>
         <Route path="/" component={() => <Empty title="Test" description="Select one." />} />
         <Route path="/:test" component={RenderTest} />
      </TestRoot>
   );
}

function RenderTest() {
   const params = useParams();
   if (!params.test || !(params.test in tests)) {
      return <Empty title="Test not found" />;
   }
   const Test = tests[params.test];
   return <Test />;
}

function TestRoot({ children }) {
   return (
      <>
         <AppShell.Sidebar>
            <AppShell.SectionHeader>Tests</AppShell.SectionHeader>
            <AppShell.Scrollable initialOffset={96}>
               <div className="flex flex-col flex-grow p-3 gap-3">
                  <nav className="flex flex-col flex-1 gap-1">
                     {Object.entries(tests).map(([key, Component]) => (
                        <AppShell.SidebarLink key={key} as={Link} href={`/${key}`}>
                           {key}
                        </AppShell.SidebarLink>
                     ))}
                  </nav>
               </div>
            </AppShell.Scrollable>
         </AppShell.Sidebar>
         <AppShell.Main>{children}</AppShell.Main>
      </>
   );
}
