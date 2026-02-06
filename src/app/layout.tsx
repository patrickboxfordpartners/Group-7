import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Credibility Intelligence Agent',
  description: 'Autonomous credibility monitoring and response system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
