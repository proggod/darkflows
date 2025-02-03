import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LayoutWrapper from './components/LayoutWrapper';
import AuthProtection from './components/AuthProtection';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'DarkFlows Router Interface',
  description: 'DarkFlows Router Interface',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-white dark:bg-gray-900`}>
        <AuthProtection>
          <LayoutWrapper>{children}</LayoutWrapper>
        </AuthProtection>
      </body>
    </html>
  );
}
