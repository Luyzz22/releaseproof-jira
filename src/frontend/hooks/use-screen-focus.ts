import { useEffect, useRef } from "react";

export function useScreenFocus(screen: string) {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: false });
  }, [screen]);

  return mainRef;
}
