import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../contexts/DarkModeContext';
import YjsEditor from './YjsEditor';
import SaveVersionButton from './SaveVersionButton';
import VersionHistory from './VersionHistory';
import { History, Save } from 'lucide-react';

const VersioningDemo: React.FC = () => {
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [lastSavedVersion, setLastSavedVersion] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Demo document configuration
  const docId = 'demo-versioning-document';
  const projectId = 'demo-project';

  const handleVersionSaved = (versionData: any) => {
    setLastSavedVersion(versionData);
    setError(null);
    console.log('Version saved:', versionData);
    
    // Show success message
    alert(`Version "${versionData.versionData.versionName}" saved successfully!`);
  };

  const handleVersionError = (errorMessage: string) => {
    setError(errorMessage);
    console.error('Version save error:', errorMessage);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Y.js Collaborative Editor with Versioning
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            This demo shows how to save versions of your Y.js collaborative documents to Firestore.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">Error: {error}</p>
          </div>
        )}

        {/* Success Display */}
        {lastSavedVersion && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-600">
              ✅ Version "{lastSavedVersion.versionData.versionName}" saved successfully!
            </p>
            <p className="text-sm text-green-500 mt-1">
              Version ID: {lastSavedVersion.versionId}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Editor Column */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              {/* Editor Header with Save Button */}
              <div className="border-b border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Collaborative Editor
                  </h2>
                  <div className="flex items-center space-x-3">
                    <SaveVersionButton
                      docId={docId}
                      projectId={projectId}
                      userId={user?.id || 'demo-user'}
                      onVersionSaved={handleVersionSaved}
                      onError={handleVersionError}
                      apiBaseUrl="http://localhost:3001"
                    />
                    <button
                      onClick={() => setShowVersionHistory(!showVersionHistory)}
                      className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                        showVersionHistory
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <History size={18} className="mr-2" />
                      History
                    </button>
                  </div>
                </div>
              </div>

              {/* Y.js Editor */}
              <div className="p-4">
                <YjsEditor
                  documentId={docId}
                  userId={user?.id || 'demo-user'}
                  userName={user?.nickname || user?.firstName || 'Demo User'}
                  userColor="#E86F2C"
                  placeholder="Start writing your screenplay... Changes are automatically synced and you can save versions at any time."
                  websocketUrl="ws://localhost:1234"
                />
              </div>
            </div>

            {/* Instructions */}
            <div className={`mt-6 p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                How to Use Versioning
              </h3>
              <div className={`space-y-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                  <div>
                    <p className="font-medium">Write Content</p>
                    <p>Type in the editor above. Changes are automatically synced with Y.js.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <div>
                    <p className="font-medium">Save Versions</p>
                    <p>Use "Quick Save" for instant versioning or the clock icon for custom version names and descriptions.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                  <div>
                    <p className="font-medium">View History</p>
                    <p>Click "History" to see all saved versions, preview content, and download versions.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                  <div>
                    <p className="font-medium">Export Formats</p>
                    <p>Choose between Screenplay format (structured), Plain text, or JSON when saving versions.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Version History Sidebar */}
          <div className="lg:col-span-1">
            {showVersionHistory && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <VersionHistory
                  docId={docId}
                  apiBaseUrl="http://localhost:3001"
                  className="p-4"
                />
              </div>
            )}

            {/* Server Status */}
            <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Server Status
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Y.js WebSocket</span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-green-600">Connected</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Express API</span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-green-600">Running</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Firebase</span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-green-600">Connected</span>
                  </span>
                </div>
              </div>
            </div>

            {/* API Endpoints */}
            <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
              <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                API Endpoints
              </h4>
              <div className="space-y-2 text-xs">
                <div>
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    POST /api/screenplays/:docId/save-version
                  </code>
                </div>
                <div>
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    GET /api/screenplays/:docId/versions
                  </code>
                </div>
                <div>
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    GET /api/screenplays/:docId/versions/:versionId
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersioningDemo;
