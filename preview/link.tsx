import { useContext, type AnchorHTMLAttributes } from "react";
import { Navigation } from "./navigation";
type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };
export default function Link({ href, onClick, prefetch: _prefetch, ...props }: Props) {
  const { navigate } = useContext(Navigation);
  const internal = href.startsWith("/") && !href.startsWith("//");
  return <a {...props} href={internal ? `#${href}` : href} onClick={(event) => {
    onClick?.(event);
    if (internal && !event.defaultPrevented) {
      event.preventDefault();
      navigate(href);
    }
  }} />;
}
