import React, { useState } from 'react';
import { Save, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface SaveVersionButtonProps {
  docId: string;
  projectId?: string;
  userId?: string;
  onVersionSaved?: (versionData: any) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
  apiBaseUrl?: string;
}

interface VersionData {
  versionName: string;
  description: string;
  format: 'screenplay' | 'plain' | 'json';
}

const SaveVersionButton: React.FC<SaveVersionButtonProps> = ({
  docId,
  projectId,
  userId,
  onVersionSaved,
  onError,
  className = '',
  disabled = false,
  apiBaseUrl = 'http://localhost:3001'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [lastSavedVersion, setLastSavedVersion] = useState<any>(null);
  const [versionData, setVersionData] = useState<VersionData>({
    versionName: '',
    description: '',
    format: 'screenplay'
  });

  const generateDefaultVersionName = () => {
    const now = new Date();
    return `Version ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  };

  const saveVersion = async (data: VersionData) => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/screenplays/${docId}/save-version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          versionName: data.versionName || generateDefaultVersionName(),
          description: data.description,
          format: data.format,
          userId,
          projectId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success) {
        setLastSavedVersion(result.versionData);
        setShowDialog(false);
        
        // Reset form
        setVersionData({
          versionName: '',
          description: '',
          format: 'screenplay'
        });

        if (onVersionSaved) {
          onVersionSaved(result);
        }

        // Show success message briefly
        setTimeout(() => {
          setLastSavedVersion(null);
        }, 3000);
      } else {
        throw new Error(result.error || 'Failed to save version');
      }
    } catch (error) {
      console.error('Error saving version:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSave = () => {
    saveVersion({
      versionName: generateDefaultVersionName(),
      description: 'Quick save version',
      format: 'screenplay'
    });
  };

  const handleCustomSave = () => {
    setShowDialog(true);
  };

  const handleDialogSave = () => {
    saveVersion(versionData);
  };

  const handleDialogCancel = () => {
    setShowDialog(false);
    setVersionData({
      versionName: '',
      description: '',
      format: 'screenplay'
    });
  };

  return (
    <>
      {/* Main Save Version Button */}
      <div className={`relative ${className}`}>
        {lastSavedVersion ? (
          <button
            disabled
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg transition-all duration-200"
          >
            <CheckCircle size={18} className="mr-2" />
            Version Saved!
          </button>
        ) : (
          <div className="flex space-x-2">
            {/* Quick Save Button */}
            <button
              onClick={handleQuickSave}
              disabled={disabled || isLoading}
              className={`flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
                disabled || isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <Loader size={18} className="mr-2 animate-spin" />
              ) : (
                <Save size={18} className="mr-2" />
              )}
              {isLoading ? 'Saving...' : 'Quick Save'}
            </button>

            {/* Custom Save Button */}
            <button
              onClick={handleCustomSave}
              disabled={disabled || isLoading}
              className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                disabled || isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-500 text-white hover:bg-gray-600 active:bg-gray-700'
              }`}
            >
              <Clock size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Custom Save Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Version</h3>
            
            <div className="space-y-4">
              {/* Version Name */}
              <div>
                <label htmlFor="versionName" className="block text-sm font-medium text-gray-700 mb-1">
                  Version Name
                </label>
                <input
                  id="versionName"
                  type="text"
                  value={versionData.versionName}
                  onChange={(e) => setVersionData(prev => ({ ...prev, versionName: e.target.value }))}
                  placeholder={generateDefaultVersionName()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  value={versionData.description}
                  onChange={(e) => setVersionData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what changed in this version..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Format Selection */}
              <div>
                <label htmlFor="format" className="block text-sm font-medium text-gray-700 mb-1">
                  Export Format
                </label>
                <select
                  id="format"
                  value={versionData.format}
                  onChange={(e) => setVersionData(prev => ({ ...prev, format: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="screenplay">Screenplay Format</option>
                  <option value="plain">Plain Text</option>
                  <option value="json">JSON Structure</option>
                </select>
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleDialogCancel}
                disabled={isLoading}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDialogSave}
                disabled={isLoading}
                className={`flex items-center px-4 py-2 rounded-md transition-all duration-200 ${
                  isLoading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader size={16} className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Save Version
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SaveVersionButton;
