import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../contexts/DarkModeContext';
import YjsEditor from './YjsEditor';
import ScreenplayNavigator from './ScreenplayNavigator';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { SaveResult } from '../types/screenplay';

interface ScreenplayEditorWithYjsProps {
  websocketUrl?: string;
}

const ScreenplayEditorWithYjs: React.FC<ScreenplayEditorWithYjsProps> = ({
  websocketUrl = 'ws://localhost:1234'
}) => {
  const { projectId, screenplayId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { user } = useAuth();
  
  // State management
  const [zoomLevel, setZoomLevel] = useState(100);
  const [documentTitle, setDocumentTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [content, setContent] = useState('');
  
  // Y.js document and provider
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);

  const screenplayData = location.state?.screenplayData;

  // Initialize Y.js WebSocket provider
  useEffect(() => {
    if (!projectId || !screenplayId) return;

    const documentId = `${projectId}-${screenplayId}`;
    const wsProvider = new WebsocketProvider(
      websocketUrl,
      documentId,
      ydoc
    );

    // Set up connection status listeners
    wsProvider.on('status', (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
      console.log('Y.js connection status:', event.status);
    });

    wsProvider.on('connection-close', () => {
      setIsConnected(false);
      console.log('Y.js connection closed');
    });

    wsProvider.on('connection-error', (error: any) => {
      console.error('Y.js WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Listen for awareness changes (collaborators)
    wsProvider.awareness.on('change', () => {
      const states = Array.from(wsProvider.awareness.getStates().entries());
      const activeCollaborators = states
        .filter(([clientId, state]) => clientId !== wsProvider.awareness.clientID && state.user)
        .map(([clientId, state]) => ({
          id: clientId,
          user: state.user,
          cursor: state.cursor
        }));
      
      setCollaborators(activeCollaborators);
    });

    // Set user information for awareness
    wsProvider.awareness.setLocalStateField('user', {
      name: user?.nickname || user?.firstName || user?.email || 'Anonymous',
      color: '#E86F2C', // Your brand color
      id: user?.id
    });

    setProvider(wsProvider);

    // Cleanup on unmount
    return () => {
      wsProvider.destroy();
    };
  }, [projectId, screenplayId, websocketUrl, ydoc, user]);

  // Handle content changes from the editor
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
    console.log('Content changed, marking as unsaved');
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (!hasChanges) return;

    const autoSaveTimer = setTimeout(() => {
      handleSave();
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [content, hasChanges]);

  // Save function (you can integrate this with your existing save logic)
  const handleSave = useCallback(async (): Promise<SaveResult> => {
    if (!projectId || !screenplayId || !hasChanges) {
      return { success: true };
    }

    setIsSaving(true);
    console.log('Starting save operation...');
    try {
      // Here you would integrate with your existing save logic
      // For now, we'll just simulate a save
      console.log('Saving screenplay content:', content);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setHasChanges(false);
      console.log('Save successful, changes cleared');
      console.log('Screenplay saved successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Error saving screenplay:', error);
      console.error('Save failed:', error instanceof Error ? error.message : 'Failed to save screenplay');
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save screenplay'
      };
    } finally {
      setIsSaving(false);
    }
  }, [projectId, screenplayId, content, hasChanges]);

  // Initialize component
  useEffect(() => {
    if (!projectId || !screenplayId || !user?.id) {
      setError('Missing required parameters: project ID, screenplay ID, or user ID');
      setLoading(false);
      return;
    }

    // Set document title from props or default
    setDocumentTitle(screenplayData?.title || 'Untitled Screenplay');
    setLoading(false);
  }, [projectId, screenplayId, user?.id, screenplayData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F2] dark:bg-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#E86F2C] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[#577B92] dark:text-gray-400">Loading screenplay...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F2] dark:bg-gray-800">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 text-lg mb-4">{error}</p>
          <button 
            onClick={() => navigate(-1)}
            className="text-[#577B92] dark:text-gray-400 hover:text-[#1E4D3A] dark:hover:text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const documentId = `${projectId}-${screenplayId}`;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Header */}
      <ScreenplayNavigator
        projectId={projectId}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        documentTitle={documentTitle}
        setDocumentTitle={setDocumentTitle}
        onSave={handleSave}
        isSaving={isSaving}
        hasChanges={hasChanges}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden mt-16">
        <div className="max-w-6xl mx-auto p-6">
          {/* Collaboration Status */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {isConnected ? 'Connected to Y.js server' : 'Disconnected from Y.js server'}
                </span>
              </div>
              
              {/* Active Collaborators */}
              {collaborators.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Active collaborators:
                  </span>
                  <div className="flex -space-x-2">
                    {collaborators.map((collaborator) => (
                      <div
                        key={collaborator.id}
                        className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                        style={{ backgroundColor: collaborator.user.color }}
                        title={collaborator.user.name}
                      >
                        {collaborator.user.name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Save Status */}
            <div className="flex items-center space-x-2">
              {isSaving && (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-[#E86F2C] border-t-transparent rounded-full animate-spin"></div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Saving...
                  </span>
                </div>
              )}
              {hasChanges && !isSaving && (
                <span className={`text-sm ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  Unsaved changes
                </span>
              )}
              {!hasChanges && !isSaving && (
                <span className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  All changes saved
                </span>
              )}
            </div>
          </div>

          {/* Y.js Editor */}
          <div 
            className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg`}
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center'
            }}
          >
            <YjsEditor
              documentId={documentId}
              userId={user?.id || 'anonymous'}
              userName={user?.nickname || user?.firstName || user?.email || 'Anonymous'}
              userColor="#E86F2C"
              className={`${isDarkMode ? 'dark' : ''}`}
              placeholder="Start writing your screenplay..."
              onContentChange={handleContentChange}
              websocketUrl={websocketUrl}
            />
          </div>

          {/* Instructions */}
          <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Y.js Collaborative Editor
            </h3>
            <div className={`text-sm space-y-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <p>• This editor is powered by Y.js for real-time collaboration</p>
              <p>• Changes are automatically synced with other connected clients</p>
              <p>• The editor connects to your Y.js WebSocket server at: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{websocketUrl}</code></p>
              <p>• You can see other users' cursors and selections in real-time</p>
              <p>• All changes are automatically saved after 2 seconds of inactivity</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenplayEditorWithYjs;