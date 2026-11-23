import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Lets a page react to links like /orders?open=<id> (from search or the dashboard).
 * Calls `handle` once with the parameters, then clears them from the address.
 */
export function useLinkParams(keys: string[], handle: (p: URLSearchParams) => void) {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (!keys.some((k) => params.has(k))) return;
    handle(params);
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
}
