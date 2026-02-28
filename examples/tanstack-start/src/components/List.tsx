export const List = ({ items = [] }: { items: React.ReactNode[] }) => (
  <ol className="list-inside list-decimal text-sm text-center sm:text-left">
    {items.map((item, i) => (
      <li key={i} className={i < items.length - 1 ? "mb-2" : ""}>
        {item}
      </li>
    ))}
  </ol>
);
