import { useEffect, useCallback, useRef, useState } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Block } from '../types';
import type { CollaboratorCursor } from '../types/screenplay';

interface PendingOperation {
  id: string;
  type: 'text_change' | 'cursor_move' | 'block_create' | 'block_delete';
  blockId: string;
  content?: string;
  timestamp: number;
  retryCount: number;
}

interface OptimisticState {
  // Local optimistic changes (immediate UI updates)
  optimisticBlocks: Block[];
  optimisticCursors: CollaboratorCursor[];
  
  // Server-confirmed state (eventual consistency)
  confirmedBlocks: Block[];
  confirmedCursors: CollaboratorCursor[];
  
  // Operations pending server confirmation
  pendingOperations: Map<string, PendingOperation>;
}

interface UseOptimisticCollaborationProps {
  projectId: string | null;
  screenplayId: string | null;
  userId: string | null;
  initialBlocks: Block[];
  onBlocksUpdate: (blocks: Block[]) => void;
  onCursorsUpdate: (cursors: CollaboratorCursor[]) => void;
  enabled?: boolean;
}

export const useOptimisticCollaboration = ({
  projectId,
  screenplayId,
  userId,
  initialBlocks,
  onBlocksUpdate,
  onCursorsUpdate,
  enabled = true
}: UseOptimisticCollaborationProps) => {
  const [state, setState] = useState<OptimisticState>({
    optimisticBlocks: initialBlocks,
    optimisticCursors: [],
    confirmedBlocks: initialBlocks,
    confirmedCursors: [],
    pendingOperations: new Map()
  });

  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncQueueRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isApplyingRemoteChanges = useRef(false);

  // Optimistic local update - immediate UI response
  const applyOptimisticChange = useCallback((
    blockId: string, 
    content: string, 
    type: string = 'action'
  ) => {
    setState(prev => {
      const updatedBlocks = prev.optimisticBlocks.map(block =>
        block.id === blockId 
          ? { ...block, content, type }
          : block
      );

      // If block doesn't exist, create it optimistically
      if (!updatedBlocks.find(b => b.id === blockId)) {
        updatedBlocks.push({
          id: blockId,
          type,
          content,
          number: updatedBlocks.length + 1
        });
      }

      return {
        ...prev,
        optimisticBlocks: updatedBlocks
      };
    });

    // Update parent component immediately
    onBlocksUpdate(state.optimisticBlocks);
  }, [onBlocksUpdate, state.optimisticBlocks]);

  // Queue server synchronization (background operation)
  const queueServerSync = useCallback(async (
    blockId: string, 
    content: string, 
    type: string = 'action'
  ) => {
    if (!projectId || !screenplayId || !userId || isApplyingRemoteChanges.current) {
      return;
    }

    // Clear existing timeout for this block
    const existingTimeout = syncQueueRef.current.get(blockId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Create pending operation
    const operationId = `${blockId}-${Date.now()}`;
    const pendingOp: PendingOperation = {
      id: operationId,
      type: 'text_change',
      blockId,
      content,
      timestamp: Date.now(),
      retryCount: 0
    };

    // Add to pending operations
    setState(prev => ({
      ...prev,
      pendingOperations: new Map(prev.pendingOperations).set(operationId, pendingOp)
    }));

    // Immediate sync for better responsiveness (no debouncing)
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

      // Remove from pending operations on success
      setState(prev => {
        const newPending = new Map(prev.pendingOperations);
        newPending.delete(operationId);
        return {
          ...prev,
          pendingOperations: newPending
        };
      });

      console.log(`✅ Synced block ${blockId} to server`);
    } catch (error) {
      console.error(`❌ Failed to sync block ${blockId}:`, error);
      
      // Retry logic for failed operations
      setTimeout(() => {
        retryFailedOperation(operationId);
      }, 1000 * Math.pow(2, pendingOp.retryCount)); // Exponential backoff
    }
  }, [projectId, screenplayId, userId]);

  // Retry failed operations with exponential backoff
  const retryFailedOperation = useCallback(async (operationId: string) => {
    const pendingOp = state.pendingOperations.get(operationId);
    if (!pendingOp || pendingOp.retryCount >= 3) {
      // Remove failed operation after 3 retries
      setState(prev => {
        const newPending = new Map(prev.pendingOperations);
        newPending.delete(operationId);
        return {
          ...prev,
          pendingOperations: newPending
        };
      });
      return;
    }

    // Increment retry count
    const updatedOp = { ...pendingOp, retryCount: pendingOp.retryCount + 1 };
    setState(prev => ({
      ...prev,
      pendingOperations: new Map(prev.pendingOperations).set(operationId, updatedOp)
    }));

    // Retry the operation
    await queueServerSync(pendingOp.blockId, pendingOp.content || '');
  }, [state.pendingOperations, queueServerSync]);

  // Optimistic text change handler
  const handleOptimisticTextChange = useCallback((
    blockId: string, 
    content: string, 
    type?: string
  ) => {
    if (!enabled) return;
    
    console.log(`Optimistic text change: blockId=${blockId}, content length=${content.length}, type=${type}`);

    // 1. Apply optimistic change immediately (0ms delay)
    applyOptimisticChange(blockId, content, type);

    // 2. Queue server sync in background
    queueServerSync(blockId, content, type);
  }, [enabled, applyOptimisticChange, queueServerSync]);

  // Optimistic cursor position update
  const handleOptimisticCursorMove = useCallback((
    sceneId: string,
    blockId: string,
    offset: number
  ) => {
    if (!enabled || !userId) return;

    const newCursor: CollaboratorCursor = {
      userId,
      position: { blockId, offset },
      sceneId,
      timestamp: Timestamp.fromMillis(Date.now())
    };

    // Update local cursor state immediately
    setState(prev => {
      const updatedCursors = prev.optimisticCursors.filter(c => c.userId !== userId);
      updatedCursors.push(newCursor);
      
      return {
        ...prev,
        optimisticCursors: updatedCursors
      };
    });

    // Update parent component
    onCursorsUpdate(state.optimisticCursors);

    // Sync to server immediately (no debouncing for cursors)
    if (projectId && screenplayId) {
      const cursorRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/cursor_positions`, userId);
      setDoc(cursorRef, {
        userId,
        sceneId,
        blockId,
        offset,
        timestamp: serverTimestamp()
      }).catch(error => {
        console.error('Failed to sync cursor position:', error);
      });
    }
  }, [enabled, userId, projectId, screenplayId, onCursorsUpdate, state.optimisticCursors]);

  // Conflict resolution using last-writer-wins strategy
  const resolveConflicts = useCallback((
    serverBlocks: Block[], 
    localBlocks: Block[]
  ): Block[] => {
    // Simple last-writer-wins for now
    // In production, you might want operational transformation
    const resolvedBlocks = [...serverBlocks];
    
    // Apply any pending local changes that aren't reflected on server
    state.pendingOperations.forEach(op => {
      if (op.type === 'text_change') {
        const blockIndex = resolvedBlocks.findIndex(b => b.id === op.blockId);
        if (blockIndex !== -1 && op.content) {
          resolvedBlocks[blockIndex] = {
            ...resolvedBlocks[blockIndex],
            content: op.content
          };
        }
      }
    });

    return resolvedBlocks;
  }, [state.pendingOperations]);

  // Set up real-time listeners for server changes
  useEffect(() => {
    if (!projectId || !screenplayId || !userId || !enabled) {
      setIsConnected(false);
      return;
    }

    console.log('🔄 Setting up optimistic collaboration listeners...');
    setIsConnected(true);

    // Listen to text changes
    const liveEditsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/live_edits`);
    const liveEditsQuery = query(liveEditsRef, orderBy('timestamp', 'desc'));

    const unsubscribeEdits = onSnapshot(
      liveEditsQuery,
      (snapshot) => {
        if (isApplyingRemoteChanges.current) return;

        const changes = snapshot.docs
          .map(doc => doc.data())
          .filter(edit => edit.userId !== userId); // Ignore our own changes

        if (changes.length === 0) return;

        console.log(`📥 Received ${changes.length} remote changes`);
        
        isApplyingRemoteChanges.current = true;
        
        setState(prev => {
          let updatedBlocks = [...prev.confirmedBlocks];
          let hasChanges = false;

          changes.forEach(edit => {
            const blockIndex = updatedBlocks.findIndex(b => b.id === edit.blockId);
            if (blockIndex !== -1) {
              const currentBlock = updatedBlocks[blockIndex];
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
            // Resolve conflicts between server state and local optimistic state
            const resolvedBlocks = resolveConflicts(updatedBlocks, prev.optimisticBlocks);
            
            setLastSyncTime(new Date());
            onBlocksUpdate(resolvedBlocks);
            
            return {
              ...prev,
              confirmedBlocks: updatedBlocks,
              optimisticBlocks: resolvedBlocks
            };
          }

          return prev;
        });

        setTimeout(() => {
          isApplyingRemoteChanges.current = false;
        }, 50);
      },
      (error) => {
        console.error('❌ Live edits listener error:', error);
        setIsConnected(false);
      }
    );

    // Listen to cursor changes
    const cursorsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/cursor_positions`);
    const unsubscribeCursors = onSnapshot(
      cursorsRef,
      (snapshot) => {
        const cursors = snapshot.docs
          .map(doc => ({
            userId: doc.id,
            ...doc.data()
          }))
          .filter(cursor => cursor.userId !== userId) as CollaboratorCursor[];

        setState(prev => ({
          ...prev,
          confirmedCursors: cursors,
          optimisticCursors: [
            ...cursors,
            ...prev.optimisticCursors.filter(c => c.userId === userId)
          ]
        }));

        onCursorsUpdate(cursors);
      },
      (error) => {
        console.error('❌ Cursors listener error:', error);
      }
    );

    return () => {
      console.log('🧹 Cleaning up optimistic collaboration listeners');
      unsubscribeEdits();
      unsubscribeCursors();
      setIsConnected(false);
      
      // Clear sync queue
      syncQueueRef.current.forEach(timeout => clearTimeout(timeout));
      syncQueueRef.current.clear();
    };
  }, [projectId, screenplayId, userId, enabled, onBlocksUpdate, onCursorsUpdate, resolveConflicts]);

  // Update optimistic blocks when initial blocks change
  useEffect(() => {
    setState(prev => ({
      ...prev,
      optimisticBlocks: initialBlocks,
      confirmedBlocks: initialBlocks
    }));
  }, [initialBlocks]);

  return {
    isConnected,
    lastSyncTime,
    pendingOperationsCount: state.pendingOperations.size,
    handleOptimisticTextChange,
    handleOptimisticCursorMove,
    optimisticBlocks: state.optimisticBlocks,
    optimisticCursors: state.optimisticCursors
  };
};
