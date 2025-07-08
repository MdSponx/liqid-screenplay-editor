import { useEffect, useRef, useCallback, useState } from 'react';
import { CollaborationManager } from '../lib/screenplay/collaborationManager';
import { useAuth } from '../contexts/AuthContext';
import type { CollaboratorCursor, SceneLock, Screenplay } from '../types/screenplay';

interface UseCollaborationProps {
  screenplay: Screenplay | null;
  projectId: string | null;
  screenplayId: string | null;
  activeBlock: string | null;
  onCursorUpdate?: (cursors: CollaboratorCursor[]) => void;
  onSceneLock?: (locks: SceneLock[]) => void;
}

export const useCollaboration = ({
  screenplay,
  projectId,
  screenplayId,
  activeBlock,
  onCursorUpdate,
  onSceneLock
}: UseCollaborationProps) => {
  const { user } = useAuth();
  const collaborationManagerRef = useRef<CollaborationManager | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorCursor[]>([]);
  const [sceneLocks, setSceneLocks] = useState<SceneLock[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize collaboration manager
  useEffect(() => {
    if (!screenplay || !user?.id || !projectId || !screenplayId) {
      return;
    }

    const handleCursorUpdate = (cursors: CollaboratorCursor[]) => {
      setCollaborators(cursors);
      onCursorUpdate?.(cursors);
    };

    const handleSceneLock = (locks: SceneLock[]) => {
      setSceneLocks(locks);
      onSceneLock?.(locks);
    };

    collaborationManagerRef.current = new CollaborationManager(
      screenplay,
      user.id,
      handleCursorUpdate,
      handleSceneLock
    );

    // Start collaboration
    collaborationManagerRef.current.startCollaboration()
      .then(() => {
        setIsConnected(true);
        console.log('Collaboration started successfully');
      })
      .catch((error) => {
        console.error('Failed to start collaboration:', error);
        setIsConnected(false);
      });

    // Cleanup on unmount
    return () => {
      if (collaborationManagerRef.current) {
        collaborationManagerRef.current.cleanup();
        collaborationManagerRef.current = null;
      }
      setIsConnected(false);
    };
  }, [screenplay, user?.id, projectId, screenplayId, onCursorUpdate, onSceneLock]);

  // Update cursor position when active block changes
  const updateCursorPosition = useCallback((sceneId: string, blockId: string, offset: number) => {
    if (collaborationManagerRef.current && isConnected) {
      collaborationManagerRef.current.updateCursorPosition(sceneId, blockId, offset);
    }
  }, [isConnected]);

  // Clear cursor position
  const clearCursorPosition = useCallback(() => {
    if (collaborationManagerRef.current && isConnected) {
      collaborationManagerRef.current.clearCursorPosition();
    }
  }, [isConnected]);

  return {
    collaborators,
    sceneLocks,
    isConnected,
    updateCursorPosition,
    clearCursorPosition
  };
};
