"use client";

import * as React from "react";

export const examples = {
  adminRich: {
    path: "github/bknd-io/bknd-examples",
    startScript: "example-admin-rich",
    initialPath: "/data/schema"
  }
};

export const StackBlitz = ({
  path,
  ratio = 9 / 16,
  example,
  ...props
}: {
  path?: string;
  ratio?: number;
  example?: keyof typeof examples;
  [key: string]: unknown;
}) => {
  const selected = example ? examples[example] : undefined;
  const finalPath = path || selected?.path || "github/bknd-io/bknd-examples";

  const params = new URLSearchParams({
    ctl: "1",
    hideExplorer: "1",
    embed: "1",
    view: "preview",
    ...(selected || {}),
    ...props
  });

  const url = new URL(
    `https://stackblitz.com/${finalPath}?${params.toString()}`
  );

  return (
    <>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          paddingTop: `${ratio * 100}%`
        }}
      >
        <iframe
          width="100%"
          height="100%"
          src={url.toString()}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            border: "none"
          }}
        />
      </div>
      <div
        style={{
          fontSize: "80%",
          opacity: 0.7,
          marginTop: "0.2rem",
          marginBottom: "1rem",
          textAlign: "center"
        }}
      >
        If you&rsquo;re having issues viewing it inline,{" "}
        <a href={url.toString()} target="_blank" rel="noreferrer">
          try in a new tab
        </a>
        .
      </div>
    </>
  );
};
