import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentFund Dashboard',
  description: 'Autonomous AI agent treasury management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 font-sans antialiased">{children}</body>
    </html>
  );
}
