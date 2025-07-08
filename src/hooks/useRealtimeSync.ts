import { useEffect, useCallback, useState } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Block, SceneDocument } from '../types';

interface UseRealtimeSyncProps {
  projectId: string | null;
  screenplayId: string | null;
  onBlocksUpdate: (blocks: Block[]) => void;
  enabled?: boolean;
}

export const useRealtimeSync = ({
  projectId,
  screenplayId,
  onBlocksUpdate,
  enabled = true
}: UseRealtimeSyncProps) => {
  const [isListening, setIsListening] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    if (!projectId || !screenplayId || !enabled) {
      setIsListening(false);
      return;
    }

    console.log('Setting up real-time sync for screenplay:', screenplayId);
    setIsListening(true);

    // Listen to scenes collection for real-time updates
    const scenesRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/scenes`);
    const scenesQuery = query(scenesRef, orderBy('order'));

    const unsubscribe = onSnapshot(
      scenesQuery,
      (snapshot) => {
        console.log('Real-time update received, processing scenes...');
        
        const sceneDocuments = snapshot.docs.map(doc => doc.data() as SceneDocument);
        
        // Reconstruct blocks array from scenes
        const allBlocks: Block[] = [];
        
        sceneDocuments.forEach(sceneDoc => {
          // Add scene heading block
          allBlocks.push({
            id: sceneDoc.id,
            type: 'scene-heading',
            content: sceneDoc.scene_heading,
            number: sceneDoc.order + 1
          });
          
          // Add scene content blocks
          allBlocks.push(...sceneDoc.blocks);
        });

        console.log(`Real-time sync: Updated with ${allBlocks.length} blocks from ${sceneDocuments.length} scenes`);
        setLastSyncTime(new Date());
        onBlocksUpdate(allBlocks);
      },
      (error) => {
        console.error('Real-time sync error:', error);
        setIsListening(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log('Cleaning up real-time sync listener');
      unsubscribe();
      setIsListening(false);
    };
  }, [projectId, screenplayId, enabled, onBlocksUpdate]);

  return {
    isListening,
    lastSyncTime
  };
};
