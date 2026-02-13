import "./globals.css";
import { Inter } from "next/font/google";
import RootProviders from "../components/RootProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "CMMS System",
  description: "Maintenance Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
