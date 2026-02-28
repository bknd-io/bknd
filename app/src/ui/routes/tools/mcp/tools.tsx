import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { getTemplate } from "./utils";
import { useMcpStore } from "./state";
import { AppShell } from "ui/layouts/AppShell";
import { TbHistory, TbHistoryOff, TbRefresh } from "react-icons/tb";
import { IconButton } from "ui/components/buttons/IconButton";
import { JsonViewer, JsonViewerTabs, type JsonViewerTabsRef } from "ui/components/code/JsonViewer";
import { Field, Form } from "ui/components/form/json-schema-form";
import { Button } from "ui/components/buttons/Button";
import * as Formy from "ui/components/form/Formy";
import { appShellStore } from "ui/store";
import { Icon } from "ui/components/display/Icon";
import { useMcpClient } from "./hooks/use-mcp-client";
import { Tooltip } from "@mantine/core";
import { Link } from "ui/components/wouter/Link";
import { useParams } from "wouter";

export function Sidebar() {
   const client = useMcpClient();
   const closeSidebar = appShellStore((store) => store.closeSidebar("default"));
   const tools = useMcpStore((state) => state.tools);
   const setTools = useMcpStore((state) => state.setTools);
   const [loading, setLoading] = useState(false);
   const [query, setQuery] = useState<string>("");
   const [error, setError] = useState<string | null>(null);
   const scrollContainerRef = useRef<HTMLDivElement>(undefined!);

   const handleRefresh = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
         const res = await client.listTools();
         if (res) setTools(res.tools);
      } catch (e) {
         console.error(e);
         setError(String(e));
      }
      setLoading(false);
   }, []);

   useEffect(() => {
      handleRefresh().then(() => {
         if (scrollContainerRef.current) {
            const selectedTool = scrollContainerRef.current.querySelector(".active");
            if (selectedTool) {
               selectedTool.scrollIntoView({ behavior: "smooth", block: "center" });
            }
         }
      });
   }, []);

   return (
      <AppShell.RouteAwareSectionHeaderAccordionItem
         scrollContainerRef={scrollContainerRef}
         title="Tools"
         identifier="tools"
         renderHeaderRight={({ active }) => (
            <div className="flex flex-row gap-2 items-center">
               {error && (
                  <Tooltip label={error}>
                     <Icon.Err className="size-5 pointer-events-auto" />
                  </Tooltip>
               )}
               <span className="flex-inline bg-primary/10 px-2 py-1.5 rounded-xl text-sm font-mono leading-none">
                  {tools.length}
               </span>
               <IconButton Icon={TbRefresh} disabled={!active || loading} onClick={handleRefresh} />
            </div>
         )}
      >
         <div className="flex flex-col flex-grow p-3 gap-3">
            <Formy.Input
               type="text"
               placeholder="Search tools"
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               autoCapitalize="none"
            />
            <nav className="flex flex-col flex-1 gap-1">
               {tools
                  .filter((tool) => tool.name.toLowerCase().includes(query.toLowerCase()))
                  .map((tool) => {
                     return (
                        <AppShell.SidebarLink
                           key={tool.name}
                           className="flex flex-col items-start h-auto py-3 gap-px"
                           as={Link}
                           href={`/tools/${tool.name}`}
                           onClick={() => {
                              //setContent(tool);
                              closeSidebar();
                           }}
                        >
                           <span className="font-mono">{tool.name}</span>
                           <span className="text-sm text-primary/50">{tool.description}</span>
                        </AppShell.SidebarLink>
                     );
                  })}
            </nav>
         </div>
      </AppShell.RouteAwareSectionHeaderAccordionItem>
   );
}

export function Content() {
   const { toolName } = useParams();
   const tools = useMcpStore((state) => state.tools);
   const tool = tools.find((tool) => tool.name === toolName);
   const addHistory = useMcpStore((state) => state.addHistory);
   const [payload, setPayload] = useState<object>(getTemplate(tool?.inputSchema));
   const [result, setResult] = useState<object | null>(null);
   const historyVisible = useMcpStore((state) => state.historyVisible);
   const setHistoryVisible = useMcpStore((state) => state.setHistoryVisible);
   const client = useMcpClient();
   const jsonViewerTabsRef = useRef<JsonViewerTabsRef>(null);
   const hasInputSchema =
      tool?.inputSchema && Object.keys(tool.inputSchema.properties ?? {}).length > 0;
   const [isPending, startTransition] = useTransition();

   useEffect(() => {
      setPayload(getTemplate(tool?.inputSchema));
      setResult(null);
   }, [toolName]);

   const handleSubmit = useCallback(async () => {
      if (!tool?.name) return;
      const request = {
         name: tool.name,
         arguments: payload,
      };
      startTransition(async () => {
         addHistory("request", request);
         const res = await client.callTool(request);
         if (res) {
            setResult(res);
            addHistory("response", res);
            jsonViewerTabsRef.current?.setSelected("Result");
         }
      });
   }, [payload]);

   if (!tool) return null;

   let readableResult = result;
   try {
      readableResult = result
         ? (result as any).content?.[0].text
            ? JSON.parse((result as any).content[0].text)
            : result
         : null;
   } catch (e) {}

   return (
      <Form
         className="flex grow flex-col min-w-0 max-w-screen"
         key={tool.name}
         schema={{
            title: "InputSchema",
            ...tool?.inputSchema,
         }}
         validateOn="submit"
         initialValues={payload}
         hiddenSubmit={false}
         onChange={(value) => {
            setPayload(value);
         }}
         onSubmit={handleSubmit}
      >
         <AppShell.SectionHeader
            className="max-w-full min-w-0"
            right={
               <div className="flex flex-row gap-2">
                  <IconButton
                     Icon={historyVisible ? TbHistoryOff : TbHistory}
                     onClick={() => setHistoryVisible(!historyVisible)}
                  />
                  <Button
                     type="submit"
                     disabled={!tool?.name || isPending}
                     variant="primary"
                     className="whitespace-nowrap"
                  >
                     Call Tool
                  </Button>
               </div>
            }
         >
            <AppShell.SectionHeaderTitle className="leading-tight">
               <span className="opacity-50">
                  Tools <span className="opacity-70">/</span>
               </span>{" "}
               <span className="truncate">{tool?.name}</span>
            </AppShell.SectionHeaderTitle>
         </AppShell.SectionHeader>
         <div className="flex grow flex-row w-vw">
            <div
               className="flex grow flex-col max-w-full"
               style={{
                  width: "calc(100% - var(--sidebar-width-right) - 1px)",
               }}
            >
               <AppShell.Scrollable>
                  <div key={JSON.stringify(tool)} className="flex flex-col py-4 px-5  gap-4">
                     <p className="text-primary/80">{tool?.description}</p>

                     {hasInputSchema && <Field name="" />}
                     <JsonViewerTabs
                        ref={jsonViewerTabsRef}
                        expand={9}
                        showCopy
                        showSize
                        tabs={{
                           Arguments: {
                              json: payload,
                              title: "Payload",
                              enabled: hasInputSchema,
                           },
                           Result: { json: readableResult, title: "Result" },
                           Configuration: {
                              json: tool ?? null,
                              title: "Configuration",
                           },
                        }}
                     />
                  </div>
               </AppShell.Scrollable>
            </div>
            {historyVisible && (
               <AppShell.Sidebar name="right" handle="left" maxWidth={window.innerWidth * 0.4}>
                  <History />
               </AppShell.Sidebar>
            )}
         </div>
      </Form>
   );
}

const History = () => {
   const history = useMcpStore((state) => state.history.slice(0, 50));

   return (
      <>
         <AppShell.SectionHeader>History</AppShell.SectionHeader>
         <AppShell.Scrollable>
            <div className="flex grow flex-col p-3 gap-1">
               {history.map((item, i) => (
                  <JsonViewer
                     key={`${item.type}-${i}`}
                     json={item.data}
                     title={item.type.substring(0, 3)}
                     expand={2}
                     showCopy
                  />
               ))}
            </div>
         </AppShell.Scrollable>
      </>
   );
};
