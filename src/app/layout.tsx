import type { Metadata } from "next";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";
import { Geist } from "next/font/google";
import { AcademyMantineProvider } from "@/components/mantine-provider";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "ChurchCore Academy",
  description: "ChurchCore Academy with ShepherdAI Academy explainable academic workflow recommendations.",
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
