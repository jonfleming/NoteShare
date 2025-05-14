'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';
import 'select2/dist/css/select2.min.css';
import type { Select2Plugin } from 'select2';
import jQuery from 'jquery';

const ReactQuill = dynamic(() => import('react-quill-new'), {
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
  const [noteId, setNoteId] = useState('');
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | ''; }>({ message: '', type: '' });
  const selectRef = useRef<HTMLSelectElement>(null);

  // Autosave functionality
  useEffect(() => {
    // Don't try to save if we don't have a noteId selected
    if (!noteId) return;

    const saveNote = async () => {      try {
        setStatus({ message: 'Saving...', type: 'success' });
        const response = await fetch(`http://localhost:4000/api/notes/${noteId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        });
        if (!response.ok) throw new Error('Failed to save note');
        setStatus({ message: 'Saved!', type: 'success' });
      } catch (error: any) {
        const message = error?.message || 'An unknown error occurred';
        setStatus({ message: 'Error saving note: ' + message, type: 'error' });
      }
    };

    // Save immediately when content changes
    const saveTimeout = setTimeout(saveNote, 1000);

    // Set up recurring autosave every 30 seconds
    const autoSaveInterval = setInterval(saveNote, 30000);

    // Cleanup
    return () => {
      clearTimeout(saveTimeout);
      clearInterval(autoSaveInterval);
    };
  }, [noteId, content]); // Depend on noteId and content
  // Clear success status after 3 seconds
  useEffect(() => {
    if (status.message === 'Saved!' || status.message === 'Loaded!') {
      const timer = setTimeout(() => {
        setStatus({ message: '', type: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    const loadSelect2 = async () => {
      // Import select2
      await import('select2');

      if (selectRef.current) {
        // Initialize select2
        jQuery(selectRef.current).select2({
          width: '200px',
          placeholder: 'Select a note',
          tags: true, // Allow creating new tags
          createTag: function(params: { term: string }) {
            // Only allow alphanumeric characters
            if (!params.term.match(/^[a-zA-Z0-9]+$/)) {
              return null;
            }
            return {
              id: params.term,
              text: params.term + ' (New)',
              newTag: true
            };
          },
          ajax: {
            url: '/api/notes',
            processResults: function (data: string[]) {
              return {
                results: data.map(noteId => ({
                  id: noteId,
                  text: noteId
                }))
              };
            }
          }
        }).on('select2:select', function (e: { params: { data: { id: string, newTag?: boolean } } }) {
          const { id, newTag } = e.params.data;
          setNoteId(id);
          
          if (newTag) {
            setContent(''); // Clear content for new notes
          } else {            // Load the note content
            setStatus({ message: 'Loading...', type: 'success' });
            fetch(`http://localhost:4000/api/notes/${id}`, {
              headers: {
                'Accept': 'application/json'
              }
            })
            .then(response => {
              if (!response.ok) throw new Error('Failed to load note');
              return response.json();
            })
            .then(data => {
              setContent(data.content);
              setStatus({ message: 'Loaded!', type: 'success' });
            })
            .catch(error => {
              const message = error?.message || 'An unknown error occurred';
              setStatus({ message: 'Error loading note: ' + message, type: 'error' });
            });
          }
        });

        // Set initial value
        if (noteId) {
          const option = new Option(noteId, noteId, true, true);
          jQuery(selectRef.current).append(option).trigger('change');
        }
      }
    };

    loadSelect2();    // Cleanup
    return () => {
      if (selectRef.current && typeof jQuery?.fn?.select2 === 'function') {
        try {
          jQuery(selectRef.current).select2('destroy');
        } catch (e) {
          console.warn('Failed to destroy select2:', e);
        }
      }
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex gap-4 mb-4 items-center">
        <select ref={selectRef} />
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
      {status.message && (
        <div 
          className={`mt-4 p-3 rounded text-sm font-normal ${
            status.type === 'success' 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
