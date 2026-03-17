import type { User } from "bknd";

export const useUser = () => {
  const getUser = () => $fetch("/api/auth/me") as Promise<{ user: User }>;
  return { getUser };
};
