import type { Metadata } from "next";
import "../styles/tokens.css";
import "./globals.css";
import "../styles/shared.css";
import "../styles/admin.css";
import "../styles/student-pwa.css";
import { Inter } from "next/font/google";
import { AcademyAppProvider } from "@/components/academy-app-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ChurchCore Academy",
  description:
    "Faith-based education management and SIS for schools, Bible institutes, seminaries, colleges, and universities.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AcademyAppProvider>
          {children}
        </AcademyAppProvider>
      </body>
    </html>
  );
}
