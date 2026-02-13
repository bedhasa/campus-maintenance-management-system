"use client";

import React from "react";
import { AppProvider } from "../App";

interface RootProvidersProps {
  children: React.ReactNode;
}

export default function RootProviders({ children }: RootProvidersProps) {
  return <AppProvider>{children}</AppProvider>;
}