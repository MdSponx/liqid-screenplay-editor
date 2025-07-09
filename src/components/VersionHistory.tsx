import React, { useState, useEffect } from 'react';
import { Clock, Eye, Download, Trash2, FileText, Code, File } from 'lucide-react';

interface Version {
  id: string;
  versionName: string;
  description: string;
  format: 'screenplay' | 'plain' | 'json';
  metadata: {
    createdAt: string;
    createdBy: string;
    exportTimestamp: string;
    sourceVersion?: number;
  };
  stats: {
    contentLength: number;
    wordCount: number;
    sceneCount: number;
  };
  hasContent: boolean;
}

interface VersionHistoryProps {
  docId: string;
  apiBaseUrl?: string;
  onVersionSelect?: (version: Version) => void;
  className?: string;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({
  docId,
  apiBaseUrl = 'http://localhost:3001',
  onVersionSelect,
  className = ''
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [viewingContent, setViewingContent] = useState<any>(null);

  useEffect(() => {
    fetchVersions();
  }, [docId]);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/screenplays/${docId}/versions`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success) {
        setVersions(result.versions);
      } else {
        throw new Error(result.error || 'Failed to fetch versions');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionContent = async (versionId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/screenplays/${docId}/versions/${versionId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success) {
        setViewingContent(result.version);
        setSelectedVersion(versionId);
      } else {
        throw new Error(result.error || 'Failed to fetch version content');
      }
    } catch (err) {
      console.error('Error fetching version content:', err);
      alert('Failed to load version content');
    }
  };

  const downloadVersion = async (version: Version) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/screenplays/${docId}/versions/${version.id}`);
      const result = await response.json();

      if (result.success) {
        const content = result.version.content;
        let downloadContent = '';
        let filename = '';
        let mimeType = '';

        switch (version.format) {
          case 'plain':
            downloadContent = content;
            filename = `${version.versionName}.txt`;
            mimeType = 'text/plain';
            break;
          case 'json':
            downloadContent = JSON.stringify(content, null, 2);
            filename = `${version.versionName}.json`;
            mimeType = 'application/json';
            break;
          case 'screenplay':
          default:
            downloadContent = content.rawContent || JSON.stringify(content, null, 2);
            filename = `${version.versionName}.txt`;
            mimeType = 'text/plain';
            break;
        }

        // Create and trigger download
        const blob = new Blob([downloadContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error downloading version:', err);
      alert('Failed to download version');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'plain':
        return <FileText size={16} className="text-gray-500" />;
      case 'json':
        return <Code size={16} className="text-blue-500" />;
      case 'screenplay':
      default:
        return <File size={16} className="text-green-500" />;
    }
  };

  const renderVersionContent = (content: any, format: string) => {
    switch (format) {
      case 'plain':
        return (
          <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
            {content}
          </pre>
        );
      case 'json':
        return (
          <pre className="text-sm text-gray-800 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        );
      case 'screenplay':
        return (
          <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
            {content.scenes && content.scenes.length > 0 ? (
              <div className="space-y-4">
                {content.scenes.map((scene: any, index: number) => (
                  <div key={index} className="border-b border-gray-200 pb-4">
                    <h4 className="font-bold text-gray-900 mb-2">{scene.heading}</h4>
                    <div className="space-y-1">
                      {scene.blocks.map((block: any, blockIndex: number) => (
                        <p key={blockIndex} className="text-sm text-gray-700">
                          {block.content}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-800">
                {content.rawContent || 'No content available'}
              </pre>
            )}
          </div>
        );
      default:
        return <p className="text-gray-500">Unknown format</p>;
    }
  };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Error loading versions: {error}</p>
          <button
            onClick={fetchVersions}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Version History</h3>
        <button
          onClick={fetchVersions}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Refresh
        </button>
      </div>

      {versions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No versions saved yet</p>
          <p className="text-sm">Use the "Save Version" button to create your first version</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version) => (
            <div
              key={version.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    {getFormatIcon(version.format)}
                    <h4 className="font-medium text-gray-900">{version.versionName}</h4>
                    <span className="text-xs text-gray-500 uppercase">{version.format}</span>
                  </div>
                  
                  {version.description && (
                    <p className="text-sm text-gray-600 mb-2">{version.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Created: {formatDate(version.metadata.createdAt)}</span>
                    <span>By: {version.metadata.createdBy}</span>
                    {version.stats.wordCount > 0 && (
                      <span>{version.stats.wordCount} words</span>
                    )}
                    {version.stats.sceneCount > 0 && (
                      <span>{version.stats.sceneCount} scenes</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => fetchVersionContent(version.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View content"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => downloadVersion(version)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>

              {/* Content Preview */}
              {selectedVersion === version.id && viewingContent && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Content Preview:</span>
                    <button
                      onClick={() => {
                        setSelectedVersion(null);
                        setViewingContent(null);
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Hide
                    </button>
                  </div>
                  {renderVersionContent(viewingContent.content, version.format)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VersionHistory;
