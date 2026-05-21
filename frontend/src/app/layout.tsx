import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'GaaliHub - Indian Slang & Linguistic Archive',
  description: 'An educational, linguistic, and cultural archive for regional Indian slangs and expressions. AI moderated community discovery platform.',
  icons: {
    icon: '/favicon.ico',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased flex flex-col min-h-screen bg-[#0f172a] text-slate-100">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-[#334155] bg-[#0c1322] py-8 text-center text-slate-400">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-white">GaaliHub © 2026</span>
                <span className="text-slate-500">|</span>
                <span>Linguistic Preservation Project</span>
              </div>
              <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-lg max-w-md text-left">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  <strong>Safety Notice:</strong> Content is submitted by users and is meant for educational, cultural, and sociological documentation. Hate speech, harassment, and targeted slurs are strictly prohibited and removed.
                </span>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
