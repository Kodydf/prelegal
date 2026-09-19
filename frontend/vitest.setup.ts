import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // Not present in tests that opt into the node environment (e.g. PDF generation).
  if (typeof window !== "undefined") window.localStorage.clear();
});
