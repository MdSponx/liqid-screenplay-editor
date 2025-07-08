import React from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';
import type { CollaboratorCursor } from '../../types/screenplay';

interface PresenceIndicatorProps {
  collaborators: CollaboratorCursor[];
  isConnected: boolean;
  isListening: boolean;
  className?: string;
}

const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  collaborators,
  isConnected,
  isListening,
  className = ''
}) => {
  const activeCollaborators = collaborators.length;
  
  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      {/* Connection status */}
      <div className="flex items-center space-x-1">
        {isConnected && isListening ? (
          <Wifi size={14} className="text-green-500" />
        ) : (
          <WifiOff size={14} className="text-red-500" />
        )}
        <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          {isConnected && isListening ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Active collaborators */}
      {isConnected && (
        <div className="flex items-center space-x-1">
          <Users size={14} className="text-blue-500" />
          <span className="text-xs text-gray-600">
            {activeCollaborators === 0 
              ? 'Solo editing' 
              : `${activeCollaborators} other${activeCollaborators === 1 ? '' : 's'} online`
            }
          </span>
        </div>
      )}

      {/* Collaborator indicators */}
      {activeCollaborators > 0 && (
        <div className="flex space-x-1">
          {collaborators.slice(0, 3).map((collaborator, index) => (
            <div
              key={collaborator.userId}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium"
              style={{
                backgroundColor: `hsl(${hashCode(collaborator.userId) % 360}, 70%, 50%)`
              }}
              title={`${collaborator.userId} is editing`}
            >
              {collaborator.userId.charAt(0).toUpperCase()}
            </div>
          ))}
          {activeCollaborators > 3 && (
            <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-xs text-white font-medium">
              +{activeCollaborators - 3}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Simple hash function for consistent colors (same as CollaboratorCursors)
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

export default PresenceIndicator;
