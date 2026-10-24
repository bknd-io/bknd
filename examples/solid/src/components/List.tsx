import { JSX } from "solid-js";

export const List = ({ items = [] }: { items: JSX.Element[] }) => (
  <ol class="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
    {items.map((item, i) => (
      <li class={i < items.length - 1 ? "mb-2" : ""}>
        {item}
      </li>
    ))}
  </ol>
);
