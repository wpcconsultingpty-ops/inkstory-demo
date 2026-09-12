import { createContext, useContext } from "react";
export const Navigation = createContext({ route: "/", navigate: (_path: string) => {} });
export function useRouter() {
  const { navigate } = useContext(Navigation);
  return { push: navigate, replace: navigate, refresh: () => {}, back: () => navigate("/") };
}
export function useSearchParams() {
  const { route } = useContext(Navigation);
  return new URLSearchParams(route.split("?")[1] ?? "");
}
export function usePathname() {
  return useContext(Navigation).route.split("?")[0];
}
