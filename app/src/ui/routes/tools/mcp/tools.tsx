import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { getClient, getTemplate } from "./utils";
import { useMcpStore } from "./state";
import { AppShell } from "ui/layouts/AppShell";
import { TbHistory, TbHistoryOff, TbRefresh } from "react-icons/tb";
import { IconButton } from "ui/components/buttons/IconButton";
import { JsonViewer, JsonViewerTabs, type JsonViewerTabsRef } from "ui/components/code/JsonViewer";
import { twMerge } from "ui/elements/mocks/tailwind-merge";
import { Field, Form } from "ui/components/form/json-schema-form";
import { Button } from "ui/components/buttons/Button";
import * as Formy from "ui/components/form/Formy";
import { appShellStore } from "ui/store";

export function Sidebar({ open, toggle }) {
   const client = getClient();
   const closeSidebar = appShellStore((store) => store.closeSidebar("default"));
   const tools = useMcpStore((state) => state.tools);
   const setTools = useMcpStore((state) => state.setTools);
   const setContent = useMcpStore((state) => state.setContent);
   const content = useMcpStore((state) => state.content);
   const [loading, setLoading] = useState(false);
   const [query, setQuery] = useState<string>("");

   const handleRefresh = useCallback(async () => {
      setLoading(true);
      const res = await client.listTools();
      if (res) setTools(res.tools);
      setLoading(false);
   }, []);

   useEffect(() => {
      handleRefresh();
   }, []);

   return (
      <AppShell.SectionHeaderAccordionItem
         title="Tools"
         open={open}
         toggle={toggle}
         renderHeaderRight={() => (
            <div className="flex flex-row gap-2 items-center">
               <span className="flex-inline bg-primary/10 px-2 py-1.5 rounded-xl text-sm font-mono leading-none">
                  {tools.length}
               </span>
               <IconButton Icon={TbRefresh} disabled={!open || loading} onClick={handleRefresh} />
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
                           className={twMerge(
                              "flex flex-col items-start h-auto py-3 gap-px",
                              content?.name === tool.name ? "active" : "",
                           )}
                           onClick={() => {
                              setContent(tool);
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
      </AppShell.SectionHeaderAccordionItem>
   );
}

export function Content() {
   const content = useMcpStore((state) => state.content);
   const addHistory = useMcpStore((state) => state.addHistory);
   const [payload, setPayload] = useState<object>(getTemplate(content?.inputSchema));
   const [result, setResult] = useState<object | null>(null);
   const historyVisible = useMcpStore((state) => state.historyVisible);
   const setHistoryVisible = useMcpStore((state) => state.setHistoryVisible);
   const client = getClient();
   const jsonViewerTabsRef = useRef<JsonViewerTabsRef>(null);
   const hasInputSchema =
      content?.inputSchema && Object.keys(content.inputSchema.properties ?? {}).length > 0;
   const [isPending, startTransition] = useTransition();

   useEffect(() => {
      setPayload(getTemplate(content?.inputSchema));
      setResult(null);
   }, [content]);

   const handleSubmit = useCallback(async () => {
      if (!content?.name) return;
      const request = {
         name: content.name,
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

   if (!content) return null;

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
         className="flex flex-grow flex-col max-w-screen"
         key={content.name}
         schema={{
            title: "InputSchema",
            ...content?.inputSchema,
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
                     Icon={historyVisible ? TbHistory : TbHistoryOff}
                     onClick={() => setHistoryVisible(!historyVisible)}
                  />
                  <Button
                     type="submit"
                     disabled={!content?.name || isPending}
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
               <span className="truncate">{content?.name}</span>
            </AppShell.SectionHeaderTitle>
         </AppShell.SectionHeader>
         <div className="flex flex-grow flex-row w-vw">
            <div className="flex flex-grow flex-col w-full">
               <AppShell.Scrollable>
                  <div key={JSON.stringify(content)} className="flex flex-col py-4 px-5  gap-4">
                     <p className="text-primary/80">{content?.description}</p>

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
                              json: content ?? null,
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
            <div className="flex flex-col flex-grow p-3 gap-1">
               {history.map((item, i) => (
                  <JsonViewer
                     key={`${item.type}-${i}`}
                     json={item.data}
                     title={item.type}
                     expand={2}
                  />
               ))}
            </div>
         </AppShell.Scrollable>
      </>
   );
};
