import { useEffect, useState } from "react";

// Runs an async function whenever `key` changes.
// Returns { data, error, loading, reload }. With keepPrevious, the last result stays in `data`
// while the next one loads (used for "show more" and filter changes so the page doesn't flash).
export default function useAsync(fn, key, { keepPrevious = false } = {}) {
  const [state, setState] = useState({ key: null, data: undefined, error: undefined });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fn().then(
      (data) => !cancelled && setState({ key, data, error: undefined }),
      (error) => !cancelled && setState({ key, data: undefined, error }),
    );
    return () => {
      cancelled = true;
    };
    // fn is intentionally not a dependency: `key` describes its inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const current = state.key === key;
  return {
    data: current || keepPrevious ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current,
    reload: () => setTick((t) => t + 1),
  };
}
