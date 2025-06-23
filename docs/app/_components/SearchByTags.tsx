"use client";

import { create } from "@orama/orama";
import { clsx } from "clsx";
import { useDocsSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

function initOrama() {
  return create({
    schema: {
      _: "string",
      title: "string",
      description: "string",
      url: "string",
      tags: "string[]",
    },
  });
}

const tagItems = [
  {
    name: "All",
    value: undefined,
  },
  {
    name: "Documentation",
    description: "Developer documentation",
    value: "documentation",
  },
  {
    name: "Guide",
    description: "User Guide",
    value: "guide",
  },
  {
    name: "OpenAPI",
    description: "OpenAPI Reference",
    value: "openapi",
  },
];

export default function DefaultSearchDialog(props: SharedProps) {
  const [tag, setTag] = useState<string>();
  const [open, setOpen] = useState(false);

  const { search, setSearch, query } = useDocsSearch({
    type: "static",
    initOrama,
    tag,
    from: "/api/search",
  });

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>

        <SearchDialogList items={query.data !== "empty" ? query.data : null} />

        <SearchDialogFooter className="flex flex-row flex-wrap gap-2 items-center">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              className={buttonVariants({
                size: "sm",
                color: "ghost",
                className: "-m-1.5 me-auto",
              })}
            >
              <span className="text-fd-muted-foreground/80 me-2">Filter</span>
              {tagItems.find((item) => item.value === tag)?.name ?? "All"}
              <ChevronDown className="size-3.5 text-fd-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className="flex flex-col p-1 gap-1" align="start">
              {tagItems.map((item, i) => {
                const isSelected = item.value === tag;

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setTag(item.value);
                      setOpen(false);
                    }}
                    className={clsx(
                      "rounded-lg text-start px-2 py-1.5",
                      isSelected
                        ? "text-fd-primary bg-fd-primary/10"
                        : "hover:text-fd-accent-foreground hover:bg-fd-accent",
                    )}
                  >
                    <p className="font-medium mb-0.5">{item.name}</p>
                    <p className="text-xs opacity-70">{item.description}</p>
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
          <a
            href="https://orama.com"
            rel="noreferrer noopener"
            className="text-xs text-nowrap text-fd-muted-foreground"
          >
            Powered by Orama
          </a>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
