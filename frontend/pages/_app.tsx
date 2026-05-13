import type { AppProps } from "next/app";
import "../app/globals.css";
import { AppProvider } from "../App";

export default function PagesApp({ Component, pageProps }: AppProps) {
  return (
    <AppProvider>
      <Component {...pageProps} />
    </AppProvider>
  );
}
