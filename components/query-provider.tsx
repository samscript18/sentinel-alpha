"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: {
            retry: false
          },
          queries: {
            retry: false,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
