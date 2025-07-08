import React from 'react';
import { Users, Wifi, WifiOff, Clock, CheckCircle } from 'lucide-react';
import type { CollaboratorCursor } from '../../types/screenplay';

interface OptimisticPresenceIndicatorProps {
  collaborators: CollaboratorCursor[];
  isConnected: boolean;
  isListening: boolean;
  pendingOperationsCount?: number;
  lastSyncTime?: Date | null;
  className?: string;
}

const OptimisticPresenceIndicator: React.FC<OptimisticPresenceIndicatorProps> = ({
  collaborators,
  isConnected,
  isListening,
  pendingOperationsCount = 0,
  lastSyncTime,
  className = ''
}) => {
  // Generate consistent colors for users
  const getUserColor = (userId: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500'
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const getConnectionStatus = () => {
    if (!isConnected) {
      return {
        icon: <WifiOff size={16} className="text-red-500" />,
        text: 'Disconnected',
        color: 'text-red-500'
      };
    }
    
    if (pendingOperationsCount > 0) {
      return {
        icon: <Clock size={16} className="text-yellow-500 animate-pulse" />,
        text: `Syncing (${pendingOperationsCount})`,
        color: 'text-yellow-500'
      };
    }
    
    if (isListening) {
      return {
        icon: <CheckCircle size={16} className="text-green-500" />,
        text: 'Connected',
        color: 'text-green-500'
      };
    }
    
    return {
      icon: <Wifi size={16} className="text-blue-500" />,
      text: 'Connecting...',
      color: 'text-blue-500'
    };
  };

  const connectionStatus = getConnectionStatus();
  const activeCollaborators = collaborators.filter(c => 
    Date.now() - c.timestamp.toMillis() < 30000 // Active within last 30 seconds
  );

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center space-x-2">
        {connectionStatus.icon}
        <span className={`text-sm font-medium ${connectionStatus.color}`}>
          {connectionStatus.text}
        </span>
      </div>

      {/* Collaborators */}
      {activeCollaborators.length > 0 && (
        <div className="flex items-center space-x-2">
          <Users size={16} className="text-gray-600" />
          
          {/* Collaborator Avatars */}
          <div className="flex -space-x-2">
            {activeCollaborators.slice(0, 5).map((collaborator) => (
              <div
                key={collaborator.userId}
                className={`
                  w-8 h-8 rounded-full border-2 border-white flex items-center justify-center
                  text-white text-xs font-bold ${getUserColor(collaborator.userId)}
                `}
                title={`${collaborator.userId} - Active in scene`}
              >
                {collaborator.userId.charAt(0).toUpperCase()}
              </div>
            ))}
            
            {/* Show count if more than 5 collaborators */}
            {activeCollaborators.length > 5 && (
              <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-500 flex items-center justify-center text-white text-xs font-bold">
                +{activeCollaborators.length - 5}
              </div>
            )}
          </div>
          
          <span className="text-sm text-gray-600">
            {activeCollaborators.length} active
          </span>
        </div>
      )}

      {/* Last Sync Time */}
      {lastSyncTime && isConnected && (
        <div className="text-xs text-gray-500">
          Last sync: {lastSyncTime.toLocaleTimeString()}
        </div>
      )}

      {/* Pending Operations Badge */}
      {pendingOperationsCount > 0 && (
        <div className="relative">
          <div className="bg-yellow-500 text-white text-xs rounded-full px-2 py-1 font-bold">
            {pendingOperationsCount} pending
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
        </div>
      )}
    </div>
  );
};

export default OptimisticPresenceIndicator;
