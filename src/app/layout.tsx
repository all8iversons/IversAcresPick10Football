import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ivers Acres Pick 10",
  description: "Pick ten NFL teams and compete with your private leagues.",
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
