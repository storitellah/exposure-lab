/**
 * Minimal history-based router. Cloudflare Pages serves index.html for all
 * paths via the SPA `_redirects` rule, so deep links work.
 */
import {
  createContext, useContext, useEffect, useState, type ReactNode, type MouseEvent,
} from 'react';

interface RouterValue {
  path: string;
  search: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterValue>({ path: '/', search: '', navigate: () => undefined });

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState(() => ({
    path: window.location.pathname,
    search: window.location.search,
  }));

  useEffect(() => {
    const onPop = () => setLoc({ path: window.location.pathname, search: window.location.search });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState(null, '', to);
    const url = new URL(to, window.location.origin);
    setLoc({ path: url.pathname, search: url.search });
    window.scrollTo(0, 0);
  };

  return (
    <RouterContext.Provider value={{ ...loc, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterValue {
  return useContext(RouterContext);
}

export function Link({
  to, children, className, ariaLabel, onNavigate,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  onNavigate?: () => void;
}) {
  const { navigate, path } = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
    onNavigate?.();
  };
  const current = path === to || (to !== '/' && path.startsWith(`${to}/`));
  return (
    <a
      href={to}
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
      aria-current={current ? 'page' : undefined}
    >
      {children}
    </a>
  );
}
