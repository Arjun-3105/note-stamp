import { ReactNode } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Full-screen workspace layout — no sidebar, no topbar
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#1c1c1e' }}>
      {children}
    </div>
  );
}
