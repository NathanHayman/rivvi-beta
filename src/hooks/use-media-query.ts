import * as React from "react";

export function useMediaQuery(query: string) {
  const [value, setValue] = React.useState(false);

  React.useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener("change", onChange);
    setValue(result.matches);

    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}

import { useEffect, useState } from "react";

function getDevice(): "mobile" | "tablet" | "desktop" | null {
  if (typeof window === "undefined") return null;

  return window.matchMedia("(min-width: 1024px)").matches
    ? "desktop"
    : window.matchMedia("(min-width: 640px)").matches
    ? "tablet"
    : "mobile";
}

function getDimensions() {
  if (typeof window === "undefined") return null;

  return { width: window.innerWidth, height: window.innerHeight };
}

export function useMediaQuery2() {
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop" | null>(
    getDevice()
  );
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(getDimensions());

  useEffect(() => {
    const checkDevice = () => {
      setDevice(getDevice());
      setDimensions(getDimensions());
    };

    // Initial detection
    checkDevice();

    // Listener for windows resize
    window.addEventListener("resize", checkDevice);

    // Cleanup listener
    return () => {
      window.removeEventListener("resize", checkDevice);
    };
  }, []);

  return {
    device,
    width: dimensions?.width,
    height: dimensions?.height,
    isMobile: device === "mobile",
    isTablet: device === "tablet",
    isDesktop: device === "desktop",
  };
}
