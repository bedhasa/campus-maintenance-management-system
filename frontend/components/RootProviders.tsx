"use client";

import React from "react";
import { AppProvider } from "../App";
import { ToastProvider } from "../lib/toast";

interface RootProvidersProps {
  children: React.ReactNode;
}

export default function RootProviders({ children }: RootProvidersProps) {
  return (
    <AppProvider>
      <ToastProvider>{children}</ToastProvider>
    </AppProvider>
  );
}
