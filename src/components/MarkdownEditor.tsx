'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
});

const modules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    ['link', 'image'],
    ['code-block'],
    ['clean'],
  ],
};

const formats = [
  'bold',
  'italic',
  'underline',
  'strike',
  'link',
  'image',
  'code-block',
];

export default function MarkdownEditor() {
  const [content, setContent] = useState('');
  const [noteId, setNoteId] = useState('note1');
  const loadNote = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/notes/${noteId}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to load note');
      const data = await response.json();
      setContent(data.content);
    } catch (error: any) {
      const message = error?.message || 'An unknown error occurred';
      alert('Error loading note: ' + message);
    }
  };

  const saveNote = async () => {
    try {
      const response = await fetch(`http://localhost:4000/api/notes/${noteId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to save note');
      alert('Note saved successfully!');
    } catch (error: any) {
      const message = error?.message || 'An unknown error occurred';
      alert('Error saving note: ' + message);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex gap-4 mb-4 items-center">
        <input
          type="text"
          value={noteId}
          onChange={(e) => setNoteId(e.target.value)}
          className="border rounded px-3 py-2 w-48"
          placeholder="Enter note ID"
        />
        <button
          onClick={loadNote}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Load
        </button>
        <button
          onClick={saveNote}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Save
        </button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <ReactQuill
          theme="snow"
          value={content}
          onChange={setContent}
          modules={modules}
          formats={formats}
          className="h-[400px]"
        />
      </div>
      <div className="mt-4 p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-2">Preview:</h3>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
}
