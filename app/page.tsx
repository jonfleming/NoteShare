'use client';

import dynamic from 'next/dynamic';

const MarkdownEditor = dynamic(() => import('../src/components/MarkdownEditor'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="container mx-auto py-8">
        <MarkdownEditor />
      </main>
    </div>
  );
}
