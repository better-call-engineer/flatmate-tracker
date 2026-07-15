import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { MonthProvider } from '@/contexts/MonthContext';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'FlatMate Tracker — Shared Expense & Meal Manager',
  description:
    'Manage shared flat expenses, grocery costs, and daily meals for your 4-person flatshare. Track balances, split bills, and settle up with ease.',
  keywords: 'flat expenses, shared bills, meal tracking, flatmate, Bangladesh',
  openGraph: {
    title: 'FlatMate Tracker',
    description: 'Shared expense and meal manager for your flat',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <MonthProvider>
            {children}
            <Toaster
              position="top-center"
              richColors
              theme="dark"
              toastOptions={{
                style: {
                  fontFamily: 'Space Grotesk, Inter, sans-serif',
                  borderRadius: '12px',
                  background: '#0d1220',
                  border: '1px solid rgba(124,58,237,0.3)',
                  color: '#f1f5f9',
                },
              }}
            />
          </MonthProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
