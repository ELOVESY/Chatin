import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chatin',
  description: 'Calculator decoy chat app'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="text-gray-100 antialiased">{children}</body>
    </html>
  );
}


