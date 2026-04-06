import { component$ } from "@builder.io/qwik";

interface Props {
   items: string[];
}

export default component$<Props>(({ items }) => {
   return (
      <ol class="list-inside list-decimal text-sm text-center sm:text-left w-full text-center">
         {items.map((item, i) => (
            <li key={i} class={`${i < items.length - 1 ? "mb-2" : ""}`}>
               <span>{item}</span>
            </li>
         ))}
      </ol>
   );
});
