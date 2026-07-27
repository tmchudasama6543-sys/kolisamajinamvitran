import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';

export const metadata: Metadata = {
  title: 'તળપદા કોળી સમાજ ઈનામ વિતરણ — પાલિતાણા',
  description: 'ડાયમંડ ગ્રુપ પાલિતાણા દ્વારા આયોજિત — AI સંચાલિત વિદ્યાર્થી ઈનામ વિતરણ પ્રણાલી.',
  robots: 'noindex, nofollow',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'કોળી સમાજ ઈનામ',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#10B981',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="gu" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Noto Sans Gujarati for proper Gujarati script rendering + Inter for Latin */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased selection:bg-primary/20 selection:text-primary">
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
