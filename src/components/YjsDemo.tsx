import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDarkMode } from '../contexts/DarkModeContext';
import YjsEditor from './YjsEditor';

const YjsDemo: React.FC = () => {
  const { user } = useAuth();
  const { isDarkMode } = useDarkMode();

  return (
    <div className={`min-h-screen p-8 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Y.js Collaborative Editor Demo
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            This demo shows how Y.js can be integrated with TipTap for real-time collaborative editing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* First Editor Instance */}
          <div className="space-y-4">
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Editor Instance 1
            </h2>
            <YjsEditor
              documentId="demo-document"
              userId={user?.id || 'user1'}
              userName={user?.nickname || user?.firstName || 'User 1'}
              userColor="#E86F2C"
              placeholder="Start typing in Editor 1..."
              websocketUrl="ws://localhost:1234"
            />
          </div>

          {/* Second Editor Instance */}
          <div className="space-y-4">
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Editor Instance 2
            </h2>
            <YjsEditor
              documentId="demo-document"
              userId="user2"
              userName="User 2"
              userColor="#3B82F6"
              placeholder="Start typing in Editor 2..."
              websocketUrl="ws://localhost:1234"
            />
          </div>
        </div>

        <div className={`mt-8 p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
          <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            How to Test Real-time Collaboration
          </h3>
          <div className={`space-y-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <div className="flex items-start space-x-2">
              <span className="font-semibold text-green-600">1.</span>
              <p>Make sure your Y.js WebSocket server is running on <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">ws://localhost:1234</code></p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-semibold text-green-600">2.</span>
              <p>Type in either editor above - you should see changes appear in both editors simultaneously</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-semibold text-green-600">3.</span>
              <p>Open this page in multiple browser tabs or windows to see multi-user collaboration</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-semibold text-green-600">4.</span>
              <p>You should see different colored cursors for different users</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="font-semibold text-green-600">5.</span>
              <p>Try formatting text (bold, italic, headings) - all formatting is synced in real-time</p>
            </div>
          </div>
        </div>

        <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-yellow-900/20' : 'bg-yellow-50'} border ${isDarkMode ? 'border-yellow-700' : 'border-yellow-200'}`}>
          <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-yellow-200' : 'text-yellow-800'}`}>
            Server Setup Required
          </h4>
          <p className={`text-sm ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
            To test this demo, you need to run a Y.js WebSocket server. Check the server files in your project root or refer to the Y.js documentation for setup instructions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default YjsDemo;
