import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
