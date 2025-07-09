import React, { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface YjsEditorProps {
  documentId: string;
  userId: string;
  userName: string;
  userColor?: string;
  className?: string;
  placeholder?: string;
  onContentChange?: (content: string) => void;
  websocketUrl?: string;
}

const YjsEditor: React.FC<YjsEditorProps> = ({
  documentId,
  userId,
  userName,
  userColor = '#E86F2C',
  className = '',
  placeholder = 'Start writing...',
  onContentChange,
  websocketUrl = 'ws://localhost:1234'
}) => {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize Y.js WebSocket provider
  useEffect(() => {
    const wsProvider = new WebsocketProvider(
      websocketUrl,
      documentId,
      ydoc
    );

    // Set up connection status listeners
    wsProvider.on('status', (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    });

    wsProvider.on('connection-close', () => {
      setIsConnected(false);
    });

    wsProvider.on('connection-error', (error: any) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    setProvider(wsProvider);

    // Cleanup on unmount
    return () => {
      wsProvider.destroy();
    };
  }, [documentId, websocketUrl, ydoc]);

  // Initialize TipTap editor with Y.js collaboration
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the default history extension since we're using Y.js
        history: false,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: userName,
          color: userColor,
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (onContentChange) {
        onContentChange(editor.getHTML());
      }
    },
  });

  // Handle content changes
  const handleContentChange = useCallback(() => {
    if (editor && onContentChange) {
      onContentChange(editor.getHTML());
    }
  }, [editor, onContentChange]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (provider) {
        provider.destroy();
      }
      if (editor) {
        editor.destroy();
      }
    };
  }, [provider, editor]);

  return (
    <div className={`yjs-editor ${className}`}>
      {/* Connection status indicator */}
      <div className="flex items-center justify-between mb-2 text-sm">
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="text-gray-500">
          Document: {documentId}
        </div>
      </div>

      {/* Editor content */}
      <div className="border border-gray-300 rounded-lg min-h-[400px] focus-within:border-blue-500 transition-colors">
        <EditorContent
          editor={editor}
          className="prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto p-4 focus:outline-none"
          placeholder={placeholder}
        />
      </div>

      {/* Toolbar (optional - can be expanded) */}
      {editor && (
        <div className="flex items-center space-x-2 mt-2 p-2 bg-gray-50 rounded-lg">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              editor.isActive('bold')
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Bold
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              editor.isActive('italic')
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Italic
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              editor.isActive('bulletList')
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            List
          </button>
        </div>
      )}
    </div>
  );
};

export default YjsEditor;
