"use client";
import { useEffect, useState } from "react";
export function useDebounced(value: string, delay = 300) {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setCurrent(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return current;
}
