import type { Metadata } from "next";
import "./globals.css";
import { ClerkClientProvider } from "@/components/providers/ClerkClientProvider";

export const metadata: Metadata = {
  title: "LearnLoop | Learn & Earn Badges",
  description: "Multi-source learning workspace with AI tutor, flashcards, quizzes, and learning passport.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkClientProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkClientProvider>
  );
}
