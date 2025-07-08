import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  Timestamp,
  doc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ThreadMessage } from '../types';

interface UseThreadMessagesProps {
  projectId?: string;
  screenplayId?: string;
  commentId: string | null;
  enabled?: boolean;
}

interface UseThreadMessagesResult {
  messages: ThreadMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (text: string, authorId: string, authorName: string, mentions?: string[]) => Promise<boolean>;
}

export const useThreadMessages = ({
  projectId,
  screenplayId,
  commentId,
  enabled = true
}: UseThreadMessagesProps): UseThreadMessagesResult => {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch thread messages with real-time updates
  useEffect(() => {
    if (!enabled || !projectId || !screenplayId || !commentId) {
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError(null);

    // Create reference to the threadMessages subcollection
    const threadMessagesPath = `projects/${projectId}/screenplays/${screenplayId}/comments/${commentId}/threadMessages`;
    const threadMessagesRef = collection(db, threadMessagesPath);
    
    // Create a query sorted by creation time
    const threadMessagesQuery = query(threadMessagesRef, orderBy('createdAt', 'asc'));

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      threadMessagesQuery,
      (snapshot) => {
        const messagesList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as ThreadMessage[];
        
        setMessages(messagesList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching thread messages:', err);
        setError('Failed to load thread messages');
        setLoading(false);
      }
    );

    // Clean up listener on unmount
    return () => unsubscribe();
  }, [projectId, screenplayId, commentId, enabled]);

  // Send a new message to the thread
  const sendMessage = useCallback(async (
    text: string, 
    authorId: string, 
    authorName: string,
    mentions: string[] = []
  ): Promise<boolean> => {
    if (!projectId || !screenplayId || !commentId) {
      setError('Missing required parameters');
      return false;
    }

    try {
      // Create reference to the threadMessages subcollection
      const threadMessagesPath = `projects/${projectId}/screenplays/${screenplayId}/comments/${commentId}/threadMessages`;
      const threadMessagesRef = collection(db, threadMessagesPath);
      
      // Create the new message
      const newMessage: Omit<ThreadMessage, 'id'> = {
        authorId,
        authorName,
        text,
        createdAt: Timestamp.now(),
        mentions,
        emoji: []
      };
      
      // Add the message to the subcollection
      await addDoc(threadMessagesRef, newMessage);
      
      // Update the thread message count on the parent comment
      const commentRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/comments`, commentId);
      await updateDoc(commentRef, {
        threadMessageCount: increment(1)
      });
      
      return true;
    } catch (error) {
      console.error('Error sending thread message:', error);
      setError('Failed to send message');
      return false;
    }
  }, [projectId, screenplayId, commentId]);

  return {
    messages,
    loading,
    error,
    sendMessage
  };
};