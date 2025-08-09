import { source } from "@/lib/source";
import { DocsPage, DocsBody, DocsDescription, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { getMDXComponents } from "@/mdx-components";
import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";

export default async function Page(props: {
   params: Promise<{ slug?: string[] }>;
}) {
   const params = await props.params;
   const page = source.getPage(params.slug);
   if (!page) notFound();

   const MDXContent = page.data.body;
   // in case a page exports a custom toc
   const toc = (page.data as any).custom_toc ?? page.data.toc;

   return (
      <DocsPage
         toc={toc}
         full={page.data.full}
         tableOfContent={{
            style: "clerk",
         }}
      >
         <DocsTitle>{page.data.title}</DocsTitle>
         <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
         <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
            <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
            <ViewOptions
               markdownUrl={`${page.url}.mdx`}
               githubUrl={`https://github.com/bknd-io/bknd/blob/dev/apps/docs/content/docs/${page.path}`}
            />
         </div>
         <DocsBody>
            <MDXContent
               components={getMDXComponents({
                  // this allows you to link to other pages with relative file paths
                  a: createRelativeLink(source, page),
               })}
            />
         </DocsBody>
      </DocsPage>
   );
}

export async function generateStaticParams() {
   return source.generateParams();
}

export async function generateMetadata(props: {
   params: Promise<{ slug?: string[] }>;
}) {
   const params = await props.params;
   const page = source.getPage(params.slug);
   if (!page) notFound();

   return {
      title: page.data.title,
      description: page.data.description,
      icons: {
         icon: "/favicon.svg",
      },
   };
}
