import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('settings')
      .select('logo_url, company_name')
      .eq('id', 1)
      .single()

    return {
      title: data?.company_name
        ? `${data.company_name} - AV Auto`
        : 'AV Auto - Piese Camioane',
      description: 'Sistem de gestiune piese camioane',
      icons: data?.logo_url ? { icon: data.logo_url } : undefined,
    }
  } catch {
    return {
      title: 'AV Auto - Piese Camioane',
      description: 'Sistem de gestiune piese camioane',
    }
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
