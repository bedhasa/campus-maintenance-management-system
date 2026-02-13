"use client";

import React from "react";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type NavigateOptions = {
  replace?: boolean;
  state?: unknown;
};

type NavigateFunction = (to: string | number, options?: NavigateOptions) => void;

type NavLinkClassName = string | ((args: { isActive: boolean }) => string);

type InternalLinkProps = React.PropsWithChildren<{
  to: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}>;

type NavLinkProps = React.PropsWithChildren<{
  to: string;
  className?: NavLinkClassName;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}>;

const NAV_STATE_KEY = "__next_nav_state";

export function useNavigate(): NavigateFunction {
  const router = useRouter();

  return (to, options) => {
    if (typeof to === "number") {
      if (to < 0) {
        router.back();
      }
      return;
    }

    if (options?.state !== undefined && typeof window !== "undefined") {
      const payload = JSON.stringify({ path: to, state: options.state });
      sessionStorage.setItem(NAV_STATE_KEY, payload);
    }

    if (options?.replace) {
      router.replace(to);
      return;
    }

    router.push(to);
  };
}

export function useLocation() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const [state, setState] = React.useState<any>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = sessionStorage.getItem(NAV_STATE_KEY);
    if (!raw) {
      setState(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { path?: string; state?: any };
      if (parsed.path === pathname) {
        setState(parsed.state ?? null);
        sessionStorage.removeItem(NAV_STATE_KEY);
        return;
      }
    } catch {
      // ignore malformed stored state
    }

    setState(null);
  }, [pathname]);

  const query = searchParams?.toString() || "";

  return {
    pathname,
    search: query ? `?${query}` : "",
    hash: "",
    state,
  };
}

export function Link({ to, children, className, onClick }: InternalLinkProps) {
  if (to.startsWith("http://") || to.startsWith("https://")) {
    return (
      <a href={to} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <NextLink href={to} className={className} onClick={onClick}>
      {children}
    </NextLink>
  );
}

export function NavLink({ to, className, onClick, children }: NavLinkProps) {
  const pathname = usePathname() || "";
  const isActive = pathname === to || pathname.startsWith(`${to}/`);
  const resolvedClassName = typeof className === "function" ? className({ isActive }) : className;

  return (
    <Link to={to} className={resolvedClassName} onClick={onClick}>
      {children}
    </Link>
  );
}