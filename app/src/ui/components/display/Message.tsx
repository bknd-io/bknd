import { IconLockAccessOff } from "@tabler/icons-react";
import { Empty, type EmptyProps } from "./Empty";

const NotFound = (props: Partial<EmptyProps>) => <Empty title="Not Found" {...props} />;
const NotAllowed = (props: Partial<EmptyProps>) => <Empty title="Not Allowed" {...props} />;
const MissingPermission = ({
   what,
   ...props
}: Partial<EmptyProps> & {
   what?: string;
}) => (
   <Empty
      Icon={IconLockAccessOff}
      title="Missing Permission"
      description={`You're not allowed to access ${what ?? "this"}.`}
      {...props}
   />
);
const NotEnabled = (props: Partial<EmptyProps>) => <Empty title="Not Enabled" {...props} />;

export const Message = {
   NotFound,
   NotAllowed,
   NotEnabled,
   MissingPermission,
};
