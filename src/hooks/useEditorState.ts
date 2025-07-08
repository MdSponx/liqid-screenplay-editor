import { useState, useCallback, useEffect } from 'react';
import { Block, EditorState, Comment, UserMention, EmojiReaction } from '../types';
import { updateBlockNumbers } from '../utils/blockUtils';
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query, orderBy, doc, updateDoc, getDoc, setDoc, where, arrayUnion, arrayRemove, FieldValue, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const useEditorState = (projectId?: string, screenplayId?: string) => {
  const [state, setState] = useState<EditorState>({
    blocks: [],
    activeBlock: null,
    selectedBlocks: new Set<string>(),
    textContent: {},
    header: { title: '', author: '', contact: '' }, // Initialized as an object
    editingHeader: false,
    undoStack: [],
    redoStack: [],
    comments: [], // Initialize comments array
  });

  // Load existing comments when screenplayId changes
  useEffect(() => {
    const fetchComments = async () => {
      if (!projectId || !screenplayId) {
        console.log('Cannot fetch comments: Missing projectId or screenplayId', { projectId, screenplayId });
        return;
      }

      try {
        console.log('[DEBUG] Fetching comments for screenplay:', screenplayId);
        const commentsColRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
        console.log(`Fetching comments for project: ${projectId}, screenplay: ${screenplayId}`);
        
        // Create a reference to the comments collection
        const commentsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
        
        // Create a query to order comments by creation time
        const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'));
        console.log('[DEBUG] Using Firestore path:', commentsColRef.path);

        // Fetch all comments
        const querySnapshot = await getDocs(commentsQuery);
        
        console.log(`Found ${querySnapshot.docs.length} comment documents in Firestore`);
        console.log('[DEBUG] Firestore query returned. Empty?', querySnapshot.empty, 'Size:', querySnapshot.size);
        
        // Map the documents to Comment objects
        const comments = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            blockId: data.blockId,
            authorId: data.authorId,
            authorName: data.authorName,
            text: data.text,
            createdAt: data.createdAt,
            isResolved: data.isResolved || false,
            startOffset: data.startOffset,
            endOffset: data.endOffset,
            highlightedText: data.highlightedText,
            mentions: data.mentions || [],
            emoji: data.emoji || [],
            threadMessageCount: data.threadMessageCount || 0
          } as Comment;
        });
        
        console.log('Mapped comment objects:', comments);
        console.log('[DEBUG] Mapped comments array:', comments);
        
        // Update the state with the comments
        setState(prev => {
          console.log('[DEBUG] About to call setState with', comments.length, 'comments.');
          console.log('Updating state with comments. Previous comments count:', prev.comments.length);
          console.log('New comments count:', comments.length);
          return {
            ...prev,
            comments: comments
          };
        });
        
        console.log(`Successfully loaded ${comments.length} comments for screenplay ${screenplayId}`);
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    };

    if (projectId && screenplayId) {
      fetchComments();
    }
  }, [projectId, screenplayId]);

  const addToHistory = useCallback((blocks: Block[]) => {
    setState(prev => ({
      ...prev,
      undoStack: [...prev.undoStack, prev.blocks],
      redoStack: [],
    }));
  }, []);

  const handleUndo = useCallback(() => {
    setState(prev => {
      if (prev.undoStack.length === 0) return prev;
      
      const previousState = prev.undoStack[prev.undoStack.length - 1];
      return {
        ...prev,
        blocks: previousState,
        redoStack: [...prev.redoStack, prev.blocks],
        undoStack: prev.undoStack.slice(0, -1),
        selectedBlocks: new Set<string>(),
      };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setState(prev => {
      if (prev.redoStack.length === 0) return prev;
      
      const nextState = prev.redoStack[prev.redoStack.length - 1];
      return {
        ...prev,
        blocks: nextState,
        undoStack: [...prev.undoStack, prev.blocks],
        redoStack: prev.redoStack.slice(0, -1),
        selectedBlocks: new Set<string>(),
      };
    });
  }, []);

  const updateBlocks = useCallback((newBlocks: Block[]) => {
    setState(prev => ({
      ...prev,
      blocks: updateBlockNumbers(newBlocks),
    }));
  }, []);

  const selectAllBlocks = useCallback(() => {
    setState(prev => {
      const allBlockIds = new Set(prev.blocks.map(block => block.id));
      return {
        ...prev,
        selectedBlocks: allBlockIds
      };
    });
  }, []);

  // Parse text for @mentions and return array of user IDs
  const parseMentions = useCallback(async (text: string): Promise<string[]> => {
    // Regular expression to match @username patterns
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    
    if (!matches) return [];
    
    // Extract usernames without the @ symbol
    const usernames = matches.map(match => match.substring(1));
    
    try {
      // Query Firestore for users with matching usernames or email prefixes
      const usersRef = collection(db, 'users');
      const userPromises = usernames.map(username => {
        // Try to match by nickname, firstName, or email
        const nicknameQuery = query(usersRef, where('nickname', '==', username));
        const firstNameQuery = query(usersRef, where('firstName', '==', username));
        const emailQuery = query(usersRef, where('email', '>=', username), where('email', '<=', username + '\uf8ff'));
        
        return Promise.all([
          getDocs(nicknameQuery),
          getDocs(firstNameQuery),
          getDocs(emailQuery)
        ]);
      });
      
      const userResults = await Promise.all(userPromises);
      
      // Collect all user IDs from the query results
      const mentionedUserIds: string[] = [];
      
      userResults.forEach(([nicknameSnap, firstNameSnap, emailSnap]) => {
        // Check nickname results
        nicknameSnap.forEach(doc => {
          mentionedUserIds.push(doc.id);
        });
        
        // Check firstName results
        firstNameSnap.forEach(doc => {
          if (!mentionedUserIds.includes(doc.id)) {
            mentionedUserIds.push(doc.id);
          }
        });
        
        // Check email results
        emailSnap.forEach(doc => {
          if (!mentionedUserIds.includes(doc.id)) {
            mentionedUserIds.push(doc.id);
          }
        });
      });
      
      return mentionedUserIds;
    } catch (error) {
      console.error('Error parsing mentions:', error);
      return [];
    }
  }, []);

  // Modified function to add a comment with Firestore integration and mentions support
  const addComment = useCallback(async (projectId: string, screenplayId: string, commentData: Comment): Promise<boolean> => {
    if (!projectId || !screenplayId) {
      console.error('Cannot save comment: Missing projectId or screenplayId');
      return false;
    }

    try {
      console.log(`Adding comment to project: ${projectId}, screenplay: ${screenplayId}`, commentData);
      
      // Create a reference to the comments collection using the correct nested path
      const commentsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
      
      // Parse mentions from the comment text
      const mentionedUserIds = await parseMentions(commentData.text);
      
      // Prepare the comment data for Firestore
      const commentToSave = {
        ...commentData,
        createdAt: serverTimestamp(), // Use server timestamp for Firestore
        mentions: mentionedUserIds, // Add the parsed mentions
        emoji: [], // Initialize empty emoji reactions array
        threadMessageCount: 0 // Initialize thread message count
      };
      
      // Add the comment to Firestore
      const docRef = await addDoc(commentsRef, commentToSave);
      
      console.log('Comment added to Firestore with ID:', docRef.id);
      
      // Update the local state with the new comment
      setState(prev => {
        const newComment = {
          ...commentData,
          id: docRef.id, // Use the Firestore-generated ID
          createdAt: Timestamp.now(), // Use client-side timestamp for immediate display
          mentions: mentionedUserIds,
          emoji: [],
          threadMessageCount: 0
        };
        
        console.log('Updating state with new comment. Current comments count:', prev.comments.length);
        
        return {
          ...prev,
          comments: [newComment, ...prev.comments]
        };
      });
      
      // If there are mentions, trigger notifications (in a real app)
      if (mentionedUserIds.length > 0) {
        console.log(`Notifying mentioned users: ${mentionedUserIds.join(', ')}`);
        // In a real app, you would trigger notifications here
      }
      
      console.log('Comment added successfully with ID:', docRef.id);
      return true; // Return success
    } catch (error) {
      console.error('Error adding comment to Firestore:', error);
      return false; // Return failure
    }
  }, [parseMentions]);

  // Function to resolve/unresolve a comment
  const resolveComment = useCallback(async (commentId: string, isResolved: boolean, projectId?: string, screenplayId?: string) => {
    console.log(`Resolving comment ${commentId} to isResolved=${isResolved}`);
    
    // Update local state immediately for responsive UI
    setState(prev => {
      // Create a deep copy of the comments array
      const updatedComments = prev.comments.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, isResolved };
        }
        return comment;
      });
      
      return {
        ...prev,
        comments: updatedComments
      };
    });
    
    // If projectId and screenplayId are provided, update the comment in Firestore
    if (projectId && screenplayId) {
      try {
        const commentRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/comments`, commentId);
        await updateDoc(commentRef, { isResolved });
        console.log(`Updated comment ${commentId} in Firestore to isResolved=${isResolved}`);
      } catch (error) {
        console.error('Error updating comment in Firestore:', error);
      }
    }
  }, []);

  // Add or toggle emoji reaction to a comment
  const toggleEmojiReaction = useCallback(async (
    commentId: string, 
    emoji: string, 
    userId: string,
    userName: string,
    projectId?: string, 
    screenplayId?: string
  ) => {
    console.log(`Toggling reaction ${emoji} for comment ${commentId} by user ${userId}`);
    
    // Update local state immediately for responsive UI
    setState(prev => {
      // Create a deep copy of the comments array
      const updatedComments = prev.comments.map(comment => {
        if (comment.id === commentId) {
          // Initialize emoji array if it doesn't exist
          const emojiReactions = comment.emoji || [];
          
          // Find if this emoji type already exists
          const existingReactionIndex = emojiReactions.findIndex(
            reaction => reaction.type === emoji
          );
          
          let updatedEmojiReactions;
          
          if (existingReactionIndex >= 0) {
            // Check if user already reacted
            const reaction = emojiReactions[existingReactionIndex];
            const userIndex = reaction.users.indexOf(userId);
            
            if (userIndex >= 0) {
              // User already reacted, so remove their reaction
              const updatedUsers = reaction.users.filter(id => id !== userId);
              const updatedDisplayNames = reaction.displayNames ? 
                reaction.displayNames.filter((_, i) => i !== userIndex) : 
                [];
              
              if (updatedUsers.length === 0) {
                // No users left, remove the entire reaction
                updatedEmojiReactions = emojiReactions.filter((_, i) => i !== existingReactionIndex);
              } else {
                // Update the users array for this reaction
                updatedEmojiReactions = [...emojiReactions];
                updatedEmojiReactions[existingReactionIndex] = {
                  ...reaction,
                  users: updatedUsers,
                  displayNames: updatedDisplayNames
                };
              }
            } else {
              // User hasn't reacted yet, so add their reaction
              updatedEmojiReactions = [...emojiReactions];
              updatedEmojiReactions[existingReactionIndex] = {
                ...reaction,
                users: [...reaction.users, userId],
                displayNames: reaction.displayNames ? 
                  [...reaction.displayNames, userName] : 
                  [userName]
              };
            }
          } else {
            // This emoji type doesn't exist yet, so add it
            updatedEmojiReactions = [
              ...emojiReactions,
              {
                type: emoji,
                users: [userId],
                displayNames: [userName]
              }
            ];
          }
          
          return {
            ...comment,
            emoji: updatedEmojiReactions
          };
        }
        return comment;
      });
      
      return {
        ...prev,
        comments: updatedComments
      };
    });
    
    // If projectId and screenplayId are provided, update the comment in Firestore
    if (projectId && screenplayId) {
      try {
        const commentRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/comments`, commentId);
        
        // First get the current comment data
        const commentDoc = await getDoc(commentRef);
        if (!commentDoc.exists()) {
          console.error(`Comment ${commentId} not found in Firestore`);
          return false;
        }
        
        const commentData = commentDoc.data();
        const emojiReactions = commentData.emoji || [];
        
        // Find if this emoji type already exists
        const existingReactionIndex = emojiReactions.findIndex(
          (reaction: EmojiReaction) => reaction.type === emoji
        );
        
        let updateData: any = {};
        
        if (existingReactionIndex >= 0) {
          // Check if user already reacted
          const reaction = emojiReactions[existingReactionIndex];
          const userIndex = reaction.users.indexOf(userId);
          
          if (userIndex >= 0) {
            // User already reacted, so remove their reaction
            // We need to create a new array without this user
            const updatedUsers = reaction.users.filter(id => id !== userId);
            const updatedDisplayNames = reaction.displayNames ? 
              reaction.displayNames.filter((_, i) => i !== userIndex) : 
              [];
            
            if (updatedUsers.length === 0) {
              // No users left, remove the entire reaction
              // We need to filter out this reaction
              updateData.emoji = emojiReactions.filter((_: any, i: number) => i !== existingReactionIndex);
            } else {
              // Update the users array for this reaction
              updateData[`emoji.${existingReactionIndex}.users`] = updatedUsers;
              if (reaction.displayNames) {
                updateData[`emoji.${existingReactionIndex}.displayNames`] = updatedDisplayNames;
              }
            }
          } else {
            // User hasn't reacted yet, so add their reaction
            updateData[`emoji.${existingReactionIndex}.users`] = arrayUnion(userId);
            if (reaction.displayNames) {
              updateData[`emoji.${existingReactionIndex}.displayNames`] = arrayUnion(userName);
            } else {
              updateData[`emoji.${existingReactionIndex}.displayNames`] = [userName];
            }
          }
        } else {
          // This emoji type doesn't exist yet, so add it
          updateData.emoji = arrayUnion({
            type: emoji,
            users: [userId],
            displayNames: [userName]
          });
        }
        
        // Update the comment in Firestore
        await updateDoc(commentRef, updateData);
        console.log(`Updated emoji reactions for comment ${commentId} in Firestore`);
        return true;
      } catch (error) {
        console.error('Error updating emoji reactions in Firestore:', error);
        return false;
      }
    }
    
    return true; // Return success for local-only updates
  }, []);

  // Fetch user mentions data
  const fetchMentionedUsers = useCallback(async (userIds: string[]): Promise<UserMention[]> => {
    if (!userIds.length) return [];
    
    try {
      const usersRef = collection(db, 'users');
      const userPromises = userIds.map(userId => getDoc(doc(usersRef, userId)));
      const userDocs = await Promise.all(userPromises);
      
      return userDocs
        .filter(doc => doc.exists())
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            displayName: data.firstName && data.lastName 
              ? `${data.firstName} ${data.lastName}` 
              : data.nickname || data.email,
            email: data.email,
            profileImage: data.profileImage
          };
        });
    } catch (error) {
      console.error('Error fetching mentioned users:', error);
      return [];
    }
  }, []);

  return {
    state,
    setState,
    addToHistory,
    handleUndo,
    handleRedo,
    updateBlocks,
    selectAllBlocks,
    addComment,
    resolveComment,
    toggleEmojiReaction,
    parseMentions,
    fetchMentionedUsers
  };
};