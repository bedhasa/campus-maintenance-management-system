import "./globals.css";
import RootProviders from "../components/RootProviders";

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
      <body suppressHydrationWarning>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
