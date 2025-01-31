'use client';

import { ThemeProvider } from '../contexts/ThemeContext';
import { EditModeProvider } from '../contexts/EditModeContext';
import { NetworkDataProvider } from '../contexts/NetworkDataContext';
import { PingDataProvider } from '../contexts/PingDataContext';
import { RefreshProvider } from '../contexts/RefreshContext';
import ClientLayout from '../ClientLayout';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <EditModeProvider>
        <NetworkDataProvider>
          <PingDataProvider>
            <RefreshProvider>
              <ClientLayout>{children}</ClientLayout>
            </RefreshProvider>
          </PingDataProvider>
        </NetworkDataProvider>
      </EditModeProvider>
    </ThemeProvider>
  );
} 