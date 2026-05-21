import { PropsWithChildren, createContext, useContext } from "react";

import { useCurrentUser } from "../state/app-shell";

type UserContextValue = {
  currentUser: ReturnType<typeof useCurrentUser>;
};

const UserContext = createContext<UserContextValue>({
  currentUser: null,
});

export function UserProvider({ children }: PropsWithChildren) {
  const currentUser = useCurrentUser();

  return (
    <UserContext.Provider value={{ currentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
