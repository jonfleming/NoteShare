'use client';

import { useState, useEffect, useRef, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import 'select2/dist/css/select2.min.css';
import type { Select2Plugin } from 'select2';
import jQuery from 'jquery';
import io from 'socket.io-client';
import ReactQuill from 'react-quill-new';

const serverUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;

// Define the props type for the editor
interface EditorProps {
  theme: string;
  value: string;
  onChange: (content: string) => void;
  modules: {
    toolbar: (string | string[])[];
  };
  formats: string[];
  className: string;
}

// Create the dynamic component with proper typing
const ReactQuillWrapper = dynamic(
  async () => {
    const { default: RQ } = await import('react-quill-new');
    return ({ forwardedRef, ...props }: EditorProps & { forwardedRef: any }) => (
      <RQ ref={forwardedRef} {...props} />
    );
  },
  { ssr: false }
);

// Helper function to handle ETag values
const getETagFromResponse = (response: Response): string => {
  const etag = response.headers.get('ETag');
  // If the ETag is already quoted, return it as is
  if (etag?.startsWith('"') && etag?.endsWith('"')) {
    return etag;
  }
  // If we have an ETag but it's not quoted, quote it
  if (etag) {
    return `"${etag}"`;
  }
  // If no ETag, return empty string
  return '';
};

interface SocketEvents {
  'content-update': {
    userId: string;
    content: string;
    cursorPosition?: { index: number; length: number; };
  };
  'user-joined': {
    userId: string;
    activeUsers: string[];
  };
  'user-left': {
    userId: string;
    activeUsers: string[];
  };
  'save-conflict': {
    noteId: string;
    currentEtag: string;
  };
  'note-saved': {
    noteId: string;
    eTag: string;
    timestamp: number;
  };
}

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
  const [lastSaved, setLastSaved] = useState<string>('');
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | ''; }>({ message: '', type: '' });  
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const selectRef = useRef<HTMLSelectElement>(null);
  const prevContent = useRef<string>(content);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const editorRef = useRef<ReactQuill | null>(null);
  const ignoreNextChangeRef = useRef(false);

  const reloadContent = async () => {
    if (!noteId) return;
    
    try {
      setStatus({ message: `Loading...`, type: 'success' });
      const response = await fetch(`${serverUrl}/api/notes/${noteId}`, {
        headers: {
          'Accept': 'application/json',
          'If-None-Match': lastSaved // Add ETag support for conflict detection
        }
      });
      
      if (!response.ok) throw new Error('Failed to load note');
      
      const data = await response.json();
      setContent(data.content);
      const eTag = getETagFromResponse(response);
      setLastSaved(eTag);
      console.log(`setLastSaved: ${eTag} on reload`);
      setStatus({ message: `Reloaded`, type: 'success' });
    } catch (error: any) {
      const message = error?.message || 'An unknown error occurred';
      setStatus({ message: 'Error reloading note: ' + message, type: 'error' });
    }
  };

  // Autosave functionality
  useEffect(() => {
    if (!noteId) return;
      
    const saveNote = async () => {
      if (prevContent.current == content && lastSaved === '') {
        console.log(('nothing to save'));
        return;

        // otherwise, get the latest ETag
      }

      console.log(`saveNote Triggered LastSaved: ${lastSaved}`);
      try {
        setStatus({ message: `Saving...`, type: 'success' });
        const response = await fetch(`${serverUrl}/api/notes/${noteId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': lastSaved
          },
          body: JSON.stringify({ content }),
        });
        if (!response.ok) throw new Error('Failed to save note');

        const eTag = getETagFromResponse(response);
        setLastSaved(eTag);
        prevContent.current = content;
        console.log(`setLastSaved: ${eTag} on save`);
        setStatus({ message: `Saved`, type: 'success' });
      } catch (error: any) {
        const message = error?.message || 'An unknown error occurred';
        setStatus({ message: 'Error saving note: ' + message, type: 'error' });
      }
    };

    if (prevContent.current !== content) {
      // Emit content change to other users
      if (socketRef.current && editorRef.current) {
        const cursorPosition = editorRef.current.getEditor().getSelection();
        ignoreNextChangeRef.current = true;
        socketRef.current.emit('content-change', {
          noteId,
          content,
          cursorPosition
        });
      }

      console.log('change Detected');
      // Clear existing timeout if any
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(saveNote, 1000);
    }

    // Set up recurring autosave every 30 seconds
    const autoSaveInterval = setInterval(saveNote, 30000);

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      clearInterval(autoSaveInterval);
    };
  }, [noteId, content]); // Remove lastSaved from dependencies

  // Clear success status after 3 seconds
  useEffect(() => {
    if (status.message.includes('Saved') || status.message.includes('Loaded!')) {
      const timer = setTimeout(() => {
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
            url: `${serverUrl}/api/notes`,
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
            fetch(`${serverUrl}/api/notes/${id}`, {
              headers: {
                'Accept': 'application/json'
              }
            })
            .then(response => {              if (!response.ok) throw new Error('Failed to load note');

              const eTag = getETagFromResponse(response);
              setLastSaved(eTag);
              console.log(`setLastSaved: ${eTag} on reload`);
              setStatus({ message: `Reloaded`, type: 'success' });
              
              return response.json();
            })
            .then(data => {
              setContent(data.content);
              setStatus({ message: `Loaded`, type: 'success' });
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

  // WebSocket connection and event handling
  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(`${serverUrl}`);
    console.log('Socket connected:', socketRef.current.id);

    socketRef.current.on('content-update', ({ userId, content, cursorPosition }: SocketEvents['content-update']) => {
      console.log(`Content update from ${userId}: ${content}`);
      if (ignoreNextChangeRef.current) {
        ignoreNextChangeRef.current = false;
        return;
      }
      
      // Update content from other users
      setContent(content);
      prevContent.current = content;
      
      // Update cursor position if available
      // if (editorRef.current && cursorPosition) {
      //   const editor = editorRef.current.getEditor();
      //   editor.setSelection(cursorPosition);
      // }
    });

    socketRef.current.on('user-joined', ({ userId, activeUsers }: SocketEvents['user-joined']) => {
      setActiveUsers(activeUsers);
      setStatus({ 
        message: `User ${userId.substring(0, 6)} joined`, 
        type: 'success' 
      });
    });

    socketRef.current.on('user-left', ({ userId, activeUsers }: SocketEvents['user-left']) => {
      setActiveUsers(activeUsers);
      setStatus({ 
        message: `User ${userId.substring(0, 6)} left`, 
        type: 'success' 
      });
    });

    socketRef.current.on('save-conflict', ({ noteId, currentEtag }: SocketEvents['save-conflict']) => {
      setStatus({ 
        message: 'Another user has saved changes. Reloading...', 
        type: 'error' 
      });
      reloadContent();
    });

    socketRef.current.on('note-saved', ({ noteId, eTag, timestamp }: SocketEvents['note-saved']) => {
      setLastSaved(eTag);
      setStatus({ 
        message: `Note saved by another user`, 
        type: 'success' 
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (noteId && socketRef.current) {
      socketRef.current.emit('join-note', noteId);
    }
  }, [noteId]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex gap-4 mb-4">
        <select ref={selectRef} />
        <div className="float-right">
        `{activeUsers.length} user{activeUsers.length !== 1 ? 's' : ''} active
      </div>      

      </div>
      <div className="border rounded-lg overflow-hidden">
        <ReactQuillWrapper
          forwardedRef={editorRef}
          theme="snow"
          value={content}
          onChange={setContent}
          modules={modules}
          formats={formats}
          className="h-[90vh]"
        />
      </div>
      {status.message && (
        <div 
          className={`mt-4 p-3 rounded font-thin ${
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
