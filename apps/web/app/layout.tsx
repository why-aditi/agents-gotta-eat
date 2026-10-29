import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// ui-03: Fredoka (OFL-1.1, app/fonts/OFL-Fredoka.txt) for headings and big numbers in the app. Committed and loaded
// locally, so builds never fetch fonts.
const fredoka = localFont({
  src: "./fonts/fredoka-latin-wght.woff2",
  variable: "--font-fredoka",
  weight: "300 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agents Gotta Eat",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={fredoka.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
