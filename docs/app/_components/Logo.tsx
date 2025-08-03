import Image from "next/image";

export function Logo() {
  return (
    <>
      <Image
        src="/logo/bknd_logo_white.svg"
        alt="bknd logo"
        width={110}
        height={24}
        className="hidden dark:block pl-1.5"
        priority
      />
      <Image
        src="/logo/bknd_logo_black.svg"
        alt="bknd logo"
        width={110}
        height={24}
        className="block dark:hidden pl-1.5"
        priority
      />
    </>
  );
}
