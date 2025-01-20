import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from './ClientLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import { EditModeProvider } from './contexts/EditModeContext';
import { NetworkDataProvider } from './contexts/NetworkDataContext';
import { PingDataProvider } from './contexts/PingDataContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Live Interface Stats',
  description: 'Real-time network interface statistics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <EditModeProvider>
            <NetworkDataProvider>
              <PingDataProvider>
                <ClientLayout>{children}</ClientLayout>
              </PingDataProvider>
            </NetworkDataProvider>
          </EditModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
