import type { Metadata } from "next";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";
import { Geist } from "next/font/google";
import { AcademyMantineProvider } from "@/components/mantine-provider";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "ChurchCore Academy",
  description:
    "Faith-based education management and SIS for schools, Bible institutes, seminaries, colleges, and universities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <AcademyMantineProvider>{children}</AcademyMantineProvider>
      </body>
    </html>
  );
}
