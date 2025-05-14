'use client';

import dynamic from 'next/dynamic';

const MarkdownEditor = dynamic(() => import('../src/components/MarkdownEditor'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Markdown Editor</h1>
        <MarkdownEditor />
      </main>
    </div>
  );
}
