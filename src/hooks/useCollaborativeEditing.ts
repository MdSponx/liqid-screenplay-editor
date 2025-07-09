import { useEffect, useCallback, useRef, useState } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  serverTimestamp,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Block } from '../types';

interface CollaborativeEdit {
  id: string;
  blockId: string;
  content: string;
  userId: string;
  timestamp: Timestamp;
  type: string;
}

interface UseCollaborativeEditingProps {
  projectId: string | null;
  screenplayId: string | null;
  userId: string | null;
  blocks: Block[];
  onBlocksUpdate: (blocks: Block[]) => void;
  enabled?: boolean;
}

export const useCollaborativeEditing = ({
  projectId,
  screenplayId,
  userId,
  blocks,
  onBlocksUpdate,
  enabled = true
}: UseCollaborativeEditingProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const pendingChangesRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isApplyingRemoteChanges = useRef(false);

  // Debounced function to sync block changes to Firestore
  const syncBlockChange = useCallback(async (blockId: string, content: string, type: string) => {
    if (!projectId || !screenplayId || !userId || isApplyingRemoteChanges.current) {
      return;
    }

    try {
      const editRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/live_edits`, blockId);
      await setDoc(editRef, {
        id: blockId,
        blockId,
        content,
        type,
        userId,
        timestamp: serverTimestamp()
      });
      
      console.log(`Synced block ${blockId} to Firestore`);
    } catch (error) {
      console.error('Error syncing block change:', error);
    }
  }, [projectId, screenplayId, userId]);

  // Debounced sync function
  const debouncedSync = useCallback((blockId: string, content: string, type: string) => {
    // Clear existing timeout for this block
    const existingTimeout = pendingChangesRef.current.get(blockId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      syncBlockChange(blockId, content, type);
      pendingChangesRef.current.delete(blockId);
    }, 300); // 300ms debounce

    pendingChangesRef.current.set(blockId, timeout);
  }, [syncBlockChange]);

  // Function to handle local block changes
  const handleBlockChange = useCallback((blockId: string, content: string, type?: string) => {
    if (!enabled || isApplyingRemoteChanges.current) return;
    
    console.log(`Collaborative editing: handleBlockChange called for blockId=${blockId}`);

    // Update local state immediately
    const updatedBlocks = blocks.map(block => 
      block.id === blockId 
        ? { ...block, content, type: type || block.type }
        : block
    );
    
    onBlocksUpdate(updatedBlocks);
    console.log(`Local state updated for blockId=${blockId}`);
    
    // Sync to Firestore with debouncing
    debouncedSync(blockId, content, type || blocks.find(b => b.id === blockId)?.type || 'action');
    console.log(`Debounced sync queued for blockId=${blockId}`);
  }, [blocks, onBlocksUpdate, debouncedSync, enabled]);

  // Set up real-time listener for collaborative edits
  useEffect(() => {
    if (!projectId || !screenplayId || !userId || !enabled) {
      setIsConnected(false);
      return;
    }

    console.log('Setting up collaborative editing listener...');
    setIsConnected(true);

    const liveEditsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/live_edits`);
    const liveEditsQuery = query(liveEditsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      liveEditsQuery,
      (snapshot) => {
        if (isApplyingRemoteChanges.current) return;

        const changes = snapshot.docs
          .map(doc => doc.data() as CollaborativeEdit)
          .filter(edit => edit.userId !== userId); // Ignore our own changes

        if (changes.length === 0) return;

        console.log(`Received ${changes.length} collaborative edits`);
        
        // Apply remote changes
        isApplyingRemoteChanges.current = true;
        
        let updatedBlocks = [...blocks];
        let hasChanges = false;

        changes.forEach(edit => {
          const blockIndex = updatedBlocks.findIndex(b => b.id === edit.blockId);
          if (blockIndex !== -1) {
            const currentBlock = updatedBlocks[blockIndex];
            // Only apply if the content is different to avoid infinite loops
            if (currentBlock.content !== edit.content || currentBlock.type !== edit.type) {
              updatedBlocks[blockIndex] = {
                ...currentBlock,
                content: edit.content,
                type: edit.type
              };
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          onBlocksUpdate(updatedBlocks);
          setLastSyncTime(new Date());
          console.log('Applied collaborative changes to local state');
        }

        // Reset flag after a short delay
        setTimeout(() => {
          isApplyingRemoteChanges.current = false;
        }, 100);
      },
      (error) => {
        console.error('Collaborative editing listener error:', error);
        setIsConnected(false);
      }
    );

    return () => {
      console.log('Cleaning up collaborative editing listener');
      unsubscribe();
      setIsConnected(false);
      
      // Clear all pending timeouts
      pendingChangesRef.current.forEach(timeout => clearTimeout(timeout));
      pendingChangesRef.current.clear();
    };
  }, [projectId, screenplayId, userId, enabled, blocks, onBlocksUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pendingChangesRef.current.forEach(timeout => clearTimeout(timeout));
      pendingChangesRef.current.clear();
    };
  }, []);

  return {
    isConnected,
    lastSyncTime,
    handleBlockChange
  };
};
