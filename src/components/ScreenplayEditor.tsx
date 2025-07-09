import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEditorState } from '../hooks/useEditorState';
import { useBlockHandlersImproved } from '../hooks/useBlockHandlersImproved';
import { useScreenplaySave } from '../hooks/useScreenplaySave';
import { useCharacterTracking } from '../hooks/useCharacterTracking';
import { useSceneHeadings } from '../hooks/useSceneHeadings';
import { useCollaboration } from '../hooks/useCollaboration';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { useCollaborativeEditing } from '../hooks/useCollaborativeEditing';
import { organizeBlocksIntoPages } from '../utils/blockUtils';
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query, orderBy, doc, updateDoc, getDoc, setDoc, where, arrayUnion, arrayRemove, FieldValue, increment, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import BlockComponentImproved from './BlockComponentImproved';
import FormatButtons from './ScreenplayEditor/FormatButtons';
import Page from './ScreenplayEditor/Page';
import { useHotkeys } from '../hooks/useHotkeys';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useAuth } from '../contexts/AuthContext';
import ScreenplayNavigator from './ScreenplayNavigator';
import SceneNavigator from './SceneNavigator/SceneNavigator';
import CharacterManager from './CharacterManager/CharacterManager';
import SceneHeadingPanel from './SceneHeadingPanel/SceneHeadingPanel';
import CommentsPanel from './ScreenplayEditor/CommentsPanel'; // Import the new CommentsPanel
import CollaboratorCursors from './screenplay/CollaboratorCursors';
import PresenceIndicator from './screenplay/PresenceIndicator';
import type { Block, PersistedEditorState, CharacterDocument, SceneDocument, UniqueSceneHeadingDocument, Comment, UserMention } from '../types';
import type { Scene } from '../hooks/useScenes';
import { Layers, Users, Type, MessageSquare } from 'lucide-react';
import { exportScreenplayToPDF } from '../utils/pdfExport';
import { exportToDocx } from '../utils/docxExport';

const ScreenplayEditor: React.FC = () => {
  const { projectId, screenplayId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { user } = useAuth();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [documentTitle, setDocumentTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterDocument[]>([]);
  const [isProcessingSuggestion, setIsProcessingSuggestion] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scenes' | 'characters' | 'headings'>('scenes');
  const [showPanel, setShowPanel] = useState(true);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [isSceneSelectionActive, setIsSceneSelectionActive] = useState(false);
  const [isSceneReordering, setIsSceneReordering] = useState(false);
  const [scrollToSceneId, setScrollToSceneId] = useState<string | null>(null); // New state for auto-scrolling
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null); // New state for active comment
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const commentCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const commentsScrollRef = useRef<HTMLDivElement>(null);
  const isScrollingProgrammatically = useRef(false);
  const [blockPositions, setBlockPositions] = useState<Record<string, number>>({});
  const [editorScrollHeight, setEditorScrollHeight] = useState(0);

  const screenplayData = location.state?.screenplayData;
  const initialBlocks = location.state?.blocks || [];

  const {
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
  } = useEditorState(projectId, screenplayId);

  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const {
    isSaving,
    hasChanges,
    error: saveError,
    handleSave,
    setHasChanges,
    setPendingSceneOrderChanges
  } = useScreenplaySave(projectId || '', screenplayId || '', user?.id || '', state.blocks, state.activeBlock);

  // Initialize character tracking
  const {
    characters: trackedCharacters,
    loading: charactersLoading,
    error: charactersError,
    addCharacter,
    syncCharactersFromBlocks
  } = useCharacterTracking({
    projectId: projectId,
    screenplayId: screenplayId || null,
    blocks: state.blocks,
    userId: user?.id || ''
  });

  // Initialize centralized scene headings management
  const {
    sceneHeadings: uniqueSceneHeadings,
    loading: sceneHeadingsLoading,
    error: sceneHeadingsError,
    refreshCache: refreshSceneHeadings
  } = useSceneHeadings({
    projectId,
    screenplayId,
    enabled: !!projectId && !!screenplayId
  });

  // Initialize collaboration
  const {
    collaborators,
    isConnected,
    updateCursorPosition,
    clearCursorPosition
  } = useCollaboration({
    screenplay: screenplayData,
    projectId: projectId || null,
    screenplayId: screenplayId || null,
    activeBlock: state.activeBlock
  });

  // Initialize real-time sync
  const { isListening } = useRealtimeSync({
    projectId: projectId || null,
    screenplayId: screenplayId || null,
    onBlocksUpdate: (newBlocks) => {
      // Only update if changes are from other users (not during save)
      if (!isSaving) {
        updateBlocks(newBlocks);
      }
    },
    enabled: true
  });

  // Initialize collaborative editing
  const { 
    isConnected: isCollaborativeEditingConnected,
    handleBlockChange: collaborativeHandleBlockChange
  } = useCollaborativeEditing({
    projectId: projectId || null,
    screenplayId: screenplayId || null,
    userId: user?.id || null,
    blocks: state.blocks,
    onBlocksUpdate: updateBlocks,
    enabled: true
  });

  // Update cursor position when active block changes
  useEffect(() => {
    if (state.activeBlock && isConnected) {
      // Find scene ID for current block
      const currentBlock = state.blocks.find(b => b.id === state.activeBlock);
      if (currentBlock) {
        // For scene heading blocks, use the block ID as scene ID
        // For other blocks, find the preceding scene heading
        let sceneId = state.activeBlock;
        if (currentBlock.type !== 'scene-heading') {
          const blockIndex = state.blocks.findIndex(b => b.id === state.activeBlock);
          for (let i = blockIndex - 1; i >= 0; i--) {
            if (state.blocks[i].type === 'scene-heading') {
              sceneId = state.blocks[i].id;
              break;
            }
          }
        }
        updateCursorPosition(sceneId, state.activeBlock, 0);
      }
    }
  }, [state.activeBlock, isConnected, updateCursorPosition, state.blocks]);

  // Update characters state when trackedCharacters changes
  useEffect(() => {
    if (trackedCharacters.length > 0) {
      setCharacters(trackedCharacters);
    }
  }, [trackedCharacters]);

  // Measure block positions for spatially aware comments
  const measureBlockPositions = useCallback(() => {
    if (!editorScrollRef.current || !blockRefs.current) return;
    
    const editorContainer = editorScrollRef.current;
    const containerRect = editorContainer.getBoundingClientRect();
    const newPositions: Record<string, number> = {};
    
    // Get the current scale factor from the zoomLevel
    const scaleFactor = zoomLevel / 100;
    
    // Get the editor's scrollable height (accounting for scale)
    setEditorScrollHeight(editorContainer.scrollHeight / scaleFactor);
    
    // Calculate position for each block
    Object.entries(blockRefs.current).forEach(([blockId, blockElement]) => {
      if (blockElement) {
        const blockRect = blockElement.getBoundingClientRect();
        
        // Calculate position relative to the editor container
        // Adjust for scale by dividing by the scale factor
        const relativeTop = (blockRect.top - containerRect.top) / scaleFactor + editorContainer.scrollTop;
        
        newPositions[blockId] = relativeTop;
      }
    });
    
    setBlockPositions(newPositions);
  }, [blockRefs, zoomLevel]);

  // Improved scroll synchronization
  const handleScroll = useCallback(() => {
    // Prevent infinite scroll loop if this scroll was programmatic
    if (isScrollingProgrammatically.current) return;

    const editorElement = editorScrollRef.current;
    const commentsPanelElement = commentsScrollRef.current;

    if (!editorElement || !commentsPanelElement) return;

    const editorScrollTop = editorElement.scrollTop;
    const editorClientHeight = editorElement.clientHeight;

    let firstVisibleBlockId: string | null = null;
    let firstVisibleBlockWithComments: string | null = null;

    // Iterate through blocks in their rendered order to find the first one that is visible.
    for (const block of state.blocks) {
      const blockId = block.id;
      const blockElement = blockRefs.current[blockId];
      const blockRelativeTop = blockPositions[blockId]; // Position relative to the editor's scroll container top

      if (blockElement && blockRelativeTop !== undefined) {
        const blockHeight = blockElement.offsetHeight; // Get actual rendered height

        // A block is considered visible if any part of it is within the editor's current viewport.
        const isVisible = (blockRelativeTop < (editorScrollTop + editorClientHeight) && 
                          (blockRelativeTop + blockHeight) > editorScrollTop);

        if (isVisible) {
          // Found the first visible block
          firstVisibleBlockId = blockId;
          
          // Check if this block has any comments
          const hasComments = state.comments.some(comment => comment.blockId === blockId);
          if (hasComments) {
            firstVisibleBlockWithComments = blockId;
            break; // Found a visible block with comments, no need to continue
          }
        }
      }
    }

    // Prioritize blocks with comments, but fall back to the first visible block
    const targetBlockId = firstVisibleBlockWithComments || firstVisibleBlockId;

    if (targetBlockId) {
      // Find the first comment associated with this block
      const correspondingComment = state.comments.find(comment => comment.blockId === targetBlockId);

      if (correspondingComment) {
        const commentCardElement = commentCardRefs.current[correspondingComment.id];
        if (commentCardElement) {
          // Set the flag to prevent the comments panel's scroll from triggering the editor's scroll
          isScrollingProgrammatically.current = true;

          // Scroll the comments panel to the corresponding comment card's position
          commentsPanelElement.scrollTo({
            top: commentCardElement.offsetTop - 16, // Add a small offset for better visibility
            behavior: 'smooth'
          });

          // Reset the programmatic scroll flag after the animation completes
          setTimeout(() => {
            isScrollingProgrammatically.current = false;
          }, 500);
        }
      }
    }
    
    // Update block positions during scroll for accuracy
    measureBlockPositions();
  }, [blockRefs, blockPositions, state.comments, commentCardRefs, state.blocks, measureBlockPositions]);

  // Initialize block positions and set up resize listener
  useEffect(() => {
    measureBlockPositions();
    
    const handleResize = () => {
      measureBlockPositions();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [measureBlockPositions, state.blocks]);

  // Re-measure block positions when zoom level changes
  useEffect(() => {
    measureBlockPositions();
  }, [zoomLevel, measureBlockPositions]);

  // NEW: Effect to sync editor scrolling to comments panel
  useEffect(() => {
    if (state.activeBlock && showCommentsPanel) {
      // Find comments associated with the active block
      const activeBlockComments = state.comments.filter(comment => 
        comment.blockId === state.activeBlock
      );
      
      if (activeBlockComments.length > 0) {
        // Set the first comment as active
        setActiveCommentId(activeBlockComments[0].id);
        
        // Scroll to the comment card if the ref exists
        const commentCardElement = commentCardRefs.current[activeBlockComments[0].id];
        if (commentCardElement) {
          commentCardElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
      }
    }
  }, [state.activeBlock, state.comments, showCommentsPanel]);

  // Smart Autosave implementation with scene reordering awareness
  useEffect(() => {
    // Clear any existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Only set up autosave if there are changes to save and not reordering scenes
    if (state.blocks.length > 0 && hasChanges && !isSceneReordering) {
      // Set a new timer for autosave (3 seconds of inactivity)
      autosaveTimerRef.current = setTimeout(async () => {
        console.log('Autosave triggered after inactivity');
        try {
          await handleSaveWithEditorState();
          console.log('Autosave completed successfully');
        } catch (err) {
          console.error('Autosave failed:', err);
        }
      }, 3000);
    }

    // Cleanup function
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [state.blocks, hasChanges, isSceneReordering]); // Added isSceneReordering to dependencies

  const updateEditorState = useCallback(async () => {
    if (!projectId || !screenplayId || !user?.id) {
      console.warn('Cannot update editor state: Missing project ID, screenplay ID, or user ID.');
      return;
    }

    try {
      const editorStateRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/editor/state`);

      const persistedEditorState: PersistedEditorState = {
        activeBlock: state.activeBlock,
        selectedBlocks: Array.from(state.selectedBlocks),
        editingHeader: state.editingHeader,
        header: typeof state.header === 'object'
          ? state.header
          : {
              title: typeof state.header === 'string' ? state.header : documentTitle,
              author: screenplayData?.metadata?.author || user.email,
              contact: ''
            },
        lastModified: new Date()
      };

      await setDoc(editorStateRef, persistedEditorState, { merge: true });
      console.log(`Updated editor state for screenplay ${screenplayId}`);
    } catch (err) {
      console.error('Error updating editor state:', err);
    }
  }, [projectId, screenplayId, user?.id, user?.email, state.activeBlock, state.selectedBlocks, state.header, state.editingHeader, documentTitle, screenplayData]);

  const handleSaveWithEditorState = useCallback(async () => {
    try {
      await updateEditorState();
      return await handleSave();
    } catch (err) {
      console.error('Error saving screenplay:', err);
      return { success: false, error: 'Failed to save screenplay' };
    }
  }, [handleSave, updateEditorState]);

  // Create a wrapper function for setSelectedBlocks that handles both direct values and functions
  const setSelectedBlocks = useCallback((blocksOrFunction: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof blocksOrFunction === 'function') {
      setState(prev => ({ ...prev, selectedBlocks: blocksOrFunction(prev.selectedBlocks) }));
    } else {
      setState(prev => ({ ...prev, selectedBlocks: blocksOrFunction }));
    }
  }, [setState]);

  // Create a wrapper function that matches the expected signature
  const onSceneHeadingUpdate = useCallback(async () => {
    await refreshSceneHeadings();
  }, [refreshSceneHeadings]);

  const {
    handleContentChange,
    handleEnterKey,
    handleKeyDown,
    handleBlockClick,
    handleBlockDoubleClick,
    handleFormatChange,
    handleMouseDown,
    clearSelection,
    isCharacterBlockAfterDialogue
  } = useBlockHandlersImproved({
    blocks: state.blocks,
    activeBlock: state.activeBlock,
    textContent: state.textContent,
    selectedBlocks: state.selectedBlocks,
    blockRefs,
    addToHistory,
    updateBlocks,
    setSelectedBlocks,
    setHasChanges,
    projectId,
    screenplayId,
    onSceneHeadingUpdate
  });

  // Helper function to recursively find a comment by ID
  const findCommentById = useCallback((comments: Comment[], commentId: string): Comment | null => {
    for (const comment of comments) {
      if (comment.id === commentId) {
        return comment;
      }
      // If the comment has replies, search recursively
      if (comment.replies && comment.replies.length > 0) {
        const found = findCommentById(comment.replies, commentId);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }, []);

  // Handle reply to comment
  const handleReplyToComment = useCallback(async (commentId: string, replyText: string): Promise<boolean> => {
    if (!projectId || !screenplayId || !user?.id) {
      console.error('Cannot add reply: Missing project ID, screenplay ID, or user ID');
      return false;
    }

    try {
      // Parse mentions from the reply text
      const mentionedUserIds = await parseMentions(replyText);

      // Create a reference to the threadMessages subcollection
      const threadMessagesRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments/${commentId}/threadMessages`);
      
      // Add the message to the subcollection
      await addDoc(threadMessagesRef, {
        authorId: user.id,
        authorName: user.nickname || user.firstName || user.email || 'Anonymous',
        text: replyText,
        createdAt: serverTimestamp(),
        mentions: mentionedUserIds, // Add the parsed mentions
        emoji: [] // Initialize empty emoji reactions array
      });
      
      // Update the thread message count on the parent comment
      const commentRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/comments`, commentId);
      await updateDoc(commentRef, {
        threadMessageCount: increment(1)
      });
      
      // Update local state to reflect the new thread message count
      setState(prev => {
        const updatedComments = prev.comments.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              threadMessageCount: (comment.threadMessageCount || 0) + 1
            };
          }
          return comment;
        });
        
        return {
          ...prev,
          comments: updatedComments
        };
      });
      
      return true;
    } catch (error) {
      console.error('Error adding reply:', error);
      return false;
    }
  }, [projectId, screenplayId, user, parseMentions, setState]);

  // Handle toggling emoji reaction on a comment
  const handleToggleEmojiReaction = useCallback(async (commentId: string, emoji: string, userName: string): Promise<boolean> => {
    if (!projectId || !screenplayId || !user?.id) {
      console.error('Cannot toggle reaction: Missing project ID, screenplay ID, or user ID');
      return false;
    }
    
    try {
      // Call the toggleEmojiReaction function from useEditorState
      return await toggleEmojiReaction(commentId, emoji, user.id, user.nickname || user.firstName || user.email || 'Anonymous', projectId, screenplayId);
    } catch (error) {
      console.error('Error toggling reaction:', error);
      return false;
    }
  }, [projectId, screenplayId, user, toggleEmojiReaction]);

  // Handle user mention search
  const handleMentionUser = useCallback(async (searchTerm: string): Promise<UserMention[]> => {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    try {
      // In a real app, this would query Firestore for users matching the search term
      // For now, we'll use a mock implementation
      const usersRef = collection(db, 'users');
      const userQuery = query(
        usersRef,
        where('email', '>=', searchTerm),
        where('email', '<=', searchTerm + '\uf8ff'),
        limit(5)
      );
      
      const querySnapshot = await getDocs(userQuery);
      
      return querySnapshot.docs.map(doc => {
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
      console.error('Error searching for users:', error);
      return [];
    }
  }, []);

  // NEW: Handle comment selection and scroll to the commented block
  const handleCommentSelect = useCallback((comment: Comment) => {
    // Set the active comment ID
    setActiveCommentId(comment.id);
    
    // Set the active block to the block containing the comment
    setState(prev => ({ ...prev, activeBlock: comment.blockId }));
    
    // Find the block element and scroll to it
    const blockElement = blockRefs.current[comment.blockId];
    if (blockElement) {
      // Scroll the block into view with smooth behavior
      blockElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Highlight the block temporarily
      blockElement.classList.add('ring-2', 'ring-[#E86F2C]', 'ring-opacity-50');
      setTimeout(() => {
        blockElement.classList.remove('ring-2', 'ring-[#E86F2C]', 'ring-opacity-50');
      }, 2000);
    }

    // NEW: Scroll to the comment card in the comments panel
    setTimeout(() => {
      const commentCardElement = commentCardRefs.current[comment.id];
      if (commentCardElement) {
        commentCardElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 150); // Small delay to ensure comment card is rendered
  }, [setState]);

  // NEW: Handle scene reordering from SceneNavigator
  const handleScenesReordered = useCallback((reorderedScenes: Scene[]) => {
    console.log("ScreenplayEditor: Handling reordered scenes", reorderedScenes.map(s => s.id));
    
    // Create a map of scene IDs to their blocks for quick lookup
    const sceneBlocksMap = new Map<string, Block[]>();
    
    // First, identify all scene heading blocks and their associated content blocks
    let currentSceneId: string | null = null;
    let currentSceneBlocks: Block[] = [];
    
    state.blocks.forEach(block => {
      if (block.type === 'scene-heading') {
        // If we were tracking a previous scene, add it to the map
        if (currentSceneId) {
          sceneBlocksMap.set(currentSceneId, currentSceneBlocks);
        }
        
        // Start tracking a new scene
        currentSceneId = block.id;
        currentSceneBlocks = [block];
      } else if (currentSceneId) {
        // Add this block to the current scene's blocks
        currentSceneBlocks.push(block);
      }
    });
    
    // Add the last scene if there is one
    if (currentSceneId) {
      sceneBlocksMap.set(currentSceneId, currentSceneBlocks);
    }
    
    // Now create a new blocks array based on the reordered scenes
    const newBlocks: Block[] = [];
    
    reorderedScenes.forEach(scene => {
      const sceneBlocks = sceneBlocksMap.get(scene.id);
      if (sceneBlocks) {
        newBlocks.push(...sceneBlocks);
      }
    });
    
    // Update the blocks state with the reordered blocks
    updateBlocks(newBlocks);
    
    // Mark as having changes that need to be saved
    setHasChanges(true);
    
    // Set the pending scene order for the next save operation
    setPendingSceneOrderChanges(reorderedScenes);
    
    console.log("ScreenplayEditor: Blocks reordered based on scene order");
  }, [state.blocks, updateBlocks, setHasChanges, setPendingSceneOrderChanges]);

  // Handle scene selection - MODIFIED to not change active block
  const handleSelectScene = useCallback((sceneId: string) => {
    // Set scene selection active to prevent suggestions
    setIsSceneSelectionActive(true);
    
    setActiveSceneId(sceneId);
    
    // Find the scene heading block in the blocks array
    const sceneHeadingIndex = state.blocks.findIndex(block => block.id === sceneId);
    
    if (sceneHeadingIndex !== -1) {
      // Only scroll to the scene heading, don't change activeBlock
      const sceneHeadingElement = blockRefs.current[sceneId];
      if (sceneHeadingElement) {
        sceneHeadingElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center'
        });
      }
    }
    
    // Reset scene selection active after a delay
    setTimeout(() => {
      setIsSceneSelectionActive(false);
    }, 300);
  }, [state.blocks]);

  // NEW: Effect for auto-scrolling to moved scene
  useEffect(() => {
    if (scrollToSceneId) {
      const sceneElement = blockRefs.current[scrollToSceneId];
      if (sceneElement) {
        // Scroll the scene into view with smooth behavior and center alignment
        sceneElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        console.log(`Auto-scrolling to moved scene: ${scrollToSceneId}`);
      } else {
        console.log(`Scene element not found for ID: ${scrollToSceneId}`);
      }
      
      // Reset the scroll target after scrolling
      setTimeout(() => {
        setScrollToSceneId(null);
      }, 100);
    }
  }, [scrollToSceneId]);

  // Deselection callback for double-click empty space
  const handleDeselectAll = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Comment: Disabled useAutoScroll to prevent interference with our custom scroll logic
  // useAutoScroll(state.activeBlock, state.blocks, blockRefs);

  useHotkeys({
    handleUndo,
    handleRedo,
    selectAllBlocks,
    blocks: state.blocks,
    activeBlock: state.activeBlock,
    handleFormatChange,
  });

  // Mark changes when blocks are updated
  useEffect(() => {
    setHasChanges(true);
  }, [state.blocks, setHasChanges]);

  // Enhanced focus management for active block changes (with suggestion awareness)
  useEffect(() => {
    if (state.activeBlock && blockRefs.current[state.activeBlock] && !isProcessingSuggestion && !isSceneSelectionActive && !isSceneReordering) {
      // Use a longer delay to ensure DOM is fully updated after state changes
      const timeoutId = setTimeout(() => {
        if (!state.activeBlock || isProcessingSuggestion || isSceneSelectionActive || isSceneReordering) return; // Additional checks
        
        const activeElement = blockRefs.current[state.activeBlock];
        if (activeElement) {
          // Check if this is a newly created action block (empty content)
          const activeBlockData = state.blocks.find(b => b.id === state.activeBlock);
          if (activeBlockData && activeBlockData.type === 'action' && activeBlockData.content === '') {
            console.log(`Focusing newly created action block: ${state.activeBlock}`);
            
            // Enhanced focus with cursor positioning
            activeElement.focus();
            
            // Ensure cursor is positioned at the start
            setTimeout(() => {
              const selection = window.getSelection();
              if (selection && activeElement) {
                const range = document.createRange();
                
                // Ensure there's a text node to work with
                if (!activeElement.firstChild) {
                  const textNode = document.createTextNode('');
                  activeElement.appendChild(textNode);
                }
                
                let textNode = activeElement.firstChild;
                if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                  range.setStart(textNode, 0);
                  range.setEnd(textNode, 0);
                  selection.removeAllRanges();
                  selection.addRange(range);
                  
                  console.log(`Cursor positioned at start of action block: ${state.activeBlock}`);
                }
              }
            }, 50);
          }
        }
      }, 150); // Longer delay to ensure React has finished rendering

      return () => clearTimeout(timeoutId);
    }
  }, [state.activeBlock, state.blocks, isProcessingSuggestion, isSceneSelectionActive, isSceneReordering]);

  useEffect(() => {
    const fetchScreenplayContent = async () => {
      if (!projectId || !screenplayId || !user?.id) {
        setError('Missing required parameters: project ID, screenplay ID, or user ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch screenplay metadata first
        const screenplayRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}`);
        const screenplaySnap = await getDoc(screenplayRef);
        
        if (!screenplaySnap.exists()) {
          setError('Screenplay not found');
          setLoading(false);
          return;
        }
        const currentScreenplayData = screenplaySnap.data();
        setDocumentTitle(currentScreenplayData?.title || 'Untitled Screenplay');

        // Fetch scenes collection to get blocks
        const scenesRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/scenes`);
        const scenesQuerySnap = await getDocs(query(scenesRef, orderBy('order')));

        let blocks: Block[] = [];

        if (!scenesQuerySnap.empty) {
          const loadedSceneDocuments = scenesQuerySnap.docs.map(doc => doc.data() as SceneDocument);
          
          // Set the first scene as active
          if (loadedSceneDocuments.length > 0) {
            setActiveSceneId(loadedSceneDocuments[0].id);
          }
          
          // Assemble the full blocks array from scene documents
          loadedSceneDocuments.forEach(sceneDoc => {
            // Add the scene heading block itself
            blocks.push({
              id: sceneDoc.id,
              type: 'scene-heading',
              content: sceneDoc.scene_heading,
              number: sceneDoc.order + 1 // Scene numbers typically start from 1
            });
            
            // Add the rest of the blocks in the scene
            blocks = blocks.concat(sceneDoc.blocks);
          });
          
          console.log(`Loaded ${loadedSceneDocuments.length} scenes with total ${blocks.length} blocks.`);
        } else {
          console.log(`No scenes found for screenplay ${screenplayId}, using default blocks.`);
          
          // Generate a unique scene ID for the initial scene heading
          const sceneId = `scene-${uuidv4()}`;
          
          // Generate a unique block ID for the initial action block
          const actionBlockId = `block-${uuidv4()}`;
          
          // Create initial blocks with proper IDs
          blocks = [
            {
              id: sceneId,
              type: 'scene-heading',
              content: '', // Changed from 'INT. LOCATION - DAY' to empty string
              number: 1
            },
            {
              id: actionBlockId,
              type: 'action',
              content: 'Write your scene description here.'
            }
          ];
          
          // Set the initial scene as active
          setActiveSceneId(sceneId);
          
          // Create the scene document in Firestore
          const sceneDocRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/scenes`, sceneId);
          
          const newSceneDoc: SceneDocument = {
            id: sceneId,
            scene_heading: '', // Changed from 'INT. LOCATION - DAY' to empty string
            blocks: [
              {
                id: actionBlockId,
                type: 'action',
                content: 'Write your scene description here.'
              }
            ],
            order: 0,
            screenplayId: screenplayId,
            projectId: projectId,
            characters_in_this_scene: [],
            elements_in_this_scene: [],
            lastModified: Timestamp.now()
          };
          
          await setDoc(sceneDocRef, newSceneDoc);
        }

        // Fetch characters and elements for suggestions
        console.log(`Fetching characters for project ${projectId}`);
        const charactersRef = collection(db, `projects/${projectId}/characters`);
        const charactersSnap = await getDocs(charactersRef);
        const loadedCharacters = charactersSnap.docs.map(doc => doc.data() as CharacterDocument);
        console.log(`Loaded ${loadedCharacters.length} unique characters:`, loadedCharacters);
        setCharacters(loadedCharacters);

        // Scene headings are now managed by the useSceneHeadings hook
        console.log(`Scene headings will be loaded by useSceneHeadings hook`);

        // Fetch comments for the screenplay
        const commentsRef = collection(db, `projects/${projectId}/screenplays/${screenplayId}/comments`);
        const commentsSnap = await getDocs(commentsRef);
        const loadedComments = commentsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Comment[];
        console.log(`Loaded ${loadedComments.length} comments`);

        // Then try to load editor state (for UI state, not for blocks)
        const editorStateRef = doc(db, `projects/${projectId}/screenplays/${screenplayId}/editor/state`);
        const editorStateSnap = await getDoc(editorStateRef);
        
        // Get header content from screenplay data or create default
        let header_content = currentScreenplayData?.header_content || {
          title: currentScreenplayData?.title || '',
          author: currentScreenplayData?.metadata?.author || user.email,
          contact: ''
        };

        if (editorStateSnap.exists()) {
          const editorState = editorStateSnap.data() as PersistedEditorState;
          console.log(`Found editor state for screenplay ${screenplayId}`);

          setState(prev => ({
            ...prev,
            blocks: blocks,
            activeBlock: editorState.activeBlock || (blocks.length > 0 ? blocks[0].id : null),
            selectedBlocks: new Set(editorState.selectedBlocks || []),
            header: editorState.header || header_content,
            editingHeader: editorState.editingHeader || false,
            comments: loadedComments // Add loaded comments to state
          }));
        } else {
          console.log(`No editor state found for screenplay ${screenplayId}, creating default state`);

          setState(prev => ({
            ...prev,
            blocks: blocks,
            activeBlock: blocks.length > 0 ? blocks[0].id : null,
            header: header_content,
            comments: loadedComments // Add loaded comments to state
          }));

          // Create default editor state
          const newEditorState: PersistedEditorState = {
            activeBlock: blocks.length > 0 ? blocks[0].id : null,
            selectedBlocks: [],
            editingHeader: false,
            header: header_content,
            lastModified: new Date()
          };

          await setDoc(editorStateRef, newEditorState);
        }
      } catch (err) {
        console.error('Error fetching screenplay data:', err);
        setError('Failed to load screenplay data');
      } finally {
        setLoading(false);
      }
    };

    // Prioritize initialBlocks from location state if available, otherwise fetch from DB
    if (initialBlocks && initialBlocks.length > 0) {
      console.log("Initializing editor with blocks from location state.");
      setState(prev => ({
        ...prev,
        blocks: initialBlocks,
        header: screenplayData?.header_content || { 
          title: screenplayData?.title || 'Untitled Screenplay', 
          author: screenplayData?.metadata?.author || user?.email, 
          contact: '' 
        }
      }));
      
      // Also set characters if available in location state
      if (location.state?.characters) {
        setCharacters(location.state.characters);
      }
      
      // Scene headings are now managed by the centralized hook
      
      setDocumentTitle(screenplayData?.title || 'Untitled Screenplay');
      setLoading(false);
    } else {
      fetchScreenplayContent();
    }
  }, [projectId, screenplayId, setState, initialBlocks, screenplayData, user?.id, user?.email, location.state]);

  // Handle PDF export
  const handleExportPDF = useCallback(() => {
    // Get all screenplay pages
    const pagesContainer = document.querySelector('.screenplay-pages');
    if (!pagesContainer) {
      console.error('Could not find screenplay pages container');
      return;
    }

    // Get all individual pages
    const pages = Array.from(pagesContainer.querySelectorAll('.screenplay-page')) as HTMLElement[];
    if (pages.length === 0) {
      console.error('No screenplay pages found');
      return;
    }

    // Export to PDF
    exportScreenplayToPDF(
      pagesContainer as HTMLElement,
      pages,
      documentTitle || 'Untitled Screenplay',
      (state.header as any)?.author || 'LiQid Screenplay Writer'
    );
  }, [documentTitle, state.header]);

  // Handle DOCX export
  const handleExportDocx = useCallback(() => {
    // Export to DOCX using the utility function
    exportToDocx(
      state.blocks,
      documentTitle || 'Untitled Screenplay',
      (state.header as any)?.author || 'LiQid Screenplay Writer',
      (state.header as any)?.contact || ''
    );
  }, [state.blocks, documentTitle, state.header]);

  // Make export functions available globally for the MoreOptionsDropdown
  useEffect(() => {
    // Create a global screenplay object if it doesn't exist
    if (!window.screenplay) {
      window.screenplay = {};
    }
    
    // Add the state and export functions to the global object
    window.screenplay.state = state;
    window.screenplay.exportToPDF = handleExportPDF;
    window.screenplay.exportToDocx = handleExportDocx;
    
    // Cleanup function
    return () => {
      if (window.screenplay) {
        delete window.screenplay.state;
        delete window.screenplay.exportToPDF;
        delete window.screenplay.exportToDocx;
      }
    };
  }, [state, handleExportPDF, handleExportDocx]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F2] dark:bg-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#E86F2C] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[#577B92] dark:text-gray-400">Loading screenplay...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F2] dark:bg-gray-800">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 text-lg mb-4">{error}</p>
          <button 
            onClick={() => navigate(-1)}
            className="text-[#577B92] dark:text-gray-400 hover:text-[#1E4D3A] dark:hover:text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const pages = organizeBlocksIntoPages(state.blocks);

  return (
    <div className="flex flex-col min-h-screen">
      <ScreenplayNavigator
        projectId={projectId}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        documentTitle={documentTitle}
        setDocumentTitle={setDocumentTitle}
        onSave={handleSaveWithEditorState}
        isSaving={isSaving}
        hasChanges={hasChanges}
      />

      {/* Second row with tab navigation */}
      <div className={`fixed top-16 left-0 right-0 z-50 ${
        isDarkMode ? 'bg-[#1E4D3A]' : 'bg-[#F5F5F2]'
      } h-12`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex h-full items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  if (activeTab === 'scenes') {
                    setShowPanel(!showPanel);
                  } else {
                    setActiveTab('scenes');
                    setShowPanel(true);
                  }
                }}
                className={`flex items-center px-4 py-1.5 rounded-full transition-all backdrop-blur-md ${
                  activeTab === 'scenes' && showPanel
                    ? 'bg-white/20 text-[#1E4D3A] border border-white/30 shadow-lg'
                    : 'text-[#1E4D3A]/70 hover:text-[#1E4D3A] hover:bg-white/10'
                }`}
              >
                <Layers size={16} className="mr-2" />
                Scenes
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'characters') {
                    setShowPanel(!showPanel);
                  } else {
                    setActiveTab('characters');
                    setShowPanel(true);
                  }
                }}
                className={`flex items-center px-4 py-1.5 rounded-full transition-all backdrop-blur-md ${
                  activeTab === 'characters' && showPanel
                    ? 'bg-white/20 text-[#1E4D3A] border border-white/30 shadow-lg'
                    : 'text-[#1E4D3A]/70 hover:text-[#1E4D3A] hover:bg-white/10'
                }`}
              >
                <Users size={16} className="mr-2" />
                Characters
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'headings') {
                    setShowPanel(!showPanel);
                  } else {
                    setActiveTab('headings');
                    setShowPanel(true);
                  }
                }}
                className={`flex items-center px-4 py-1.5 rounded-full transition-all backdrop-blur-md ${
                  activeTab === 'headings' && showPanel
                    ? 'bg-white/20 text-[#1E4D3A] border border-white/30 shadow-lg'
                    : 'text-[#1E4D3A]/70 hover:text-[#1E4D3A] hover:bg-white/10'
                }`}
              >
                <Type size={16} className="mr-2" />
                Headings
              </button>
              <div className="ml-auto flex items-center space-x-4">
                <PresenceIndicator
                  collaborators={collaborators}
                  isConnected={isConnected}
                  isListening={isListening}
                  className="text-[#1E4D3A]/70"
                />
                <button
                  onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                  className={`flex items-center px-4 py-1.5 rounded-full transition-all backdrop-blur-md ${
                    showCommentsPanel
                      ? 'bg-white/20 text-[#1E4D3A] border border-white/30 shadow-lg'
                      : 'text-[#1E4D3A]/70 hover:text-[#1E4D3A] hover:bg-white/10'
                  }`}
                >
                  <MessageSquare size={16} className="mr-2" />
                  Comments
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden mt-28">
        {/* Scene Navigator & Character Manager Sidebar - Now fixed position */}
        {showPanel && (
          <div className="fixed-sidebar">
            <div className="fixed-sidebar-content">
              {activeTab === 'scenes' && (
                <SceneNavigator
                  projectId={projectId || ''}
                  screenplayId={screenplayId || ''}
                  activeSceneId={activeSceneId}
                  onSelectScene={handleSelectScene}
                  onReorderStatusChange={setIsSceneReordering}
                  onScenesReordered={handleScenesReordered}
                  onSceneMoved={setScrollToSceneId} // New prop for auto-scrolling
                />
              )}
              
              {activeTab === 'characters' && (
                <CharacterManager
                  projectId={projectId || ''}
                  screenplayId={screenplayId || ''}
                />
              )}
              
              {activeTab === 'headings' && (
                <SceneHeadingPanel
                  projectId={projectId || ''}
                  screenplayId={screenplayId}
                />
              )}
            </div>
          </div>
        )}

        {/* Main content area with screenplay and comments panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Screenplay content area */}
          <div 
            ref={editorScrollRef}
            onScroll={handleScroll}
            className={`flex-1 overflow-auto screenplay-content relative user-select-text ${showPanel ? 'ml-80' : ''} ${showCommentsPanel ? 'mr-80' : ''}`} 
            data-screenplay-editor="true"
          >
            <div 
              className="max-w-[210mm] mx-auto my-8 screenplay-pages pb-24"
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center'
              }}
              data-screenplay-pages="true"
            >
              <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
                  <div className="relative user-select-text">
                    {pages.map((pageBlocks, pageIndex) => (
                      <Page
                        key={pageIndex}
                        pageIndex={pageIndex}
                        blocks={pageBlocks}
                        isDarkMode={isDarkMode}
                        header={state.header as any}
                        editingHeader={state.editingHeader}
                        onHeaderChange={(newHeader) => setState(prev => ({ 
                          ...prev, 
                          header: { 
                            title: newHeader, 
                            author: (prev.header as any)?.author || user?.email || '', 
                            contact: (prev.header as any)?.contact || '' 
                          } 
                        }))}
                        onEditingHeaderChange={(editingHeader) => setState(prev => ({ ...prev, editingHeader }))}
                        onContentChange={collaborativeHandleBlockChange}
                        onKeyDown={handleKeyDown}
                        onBlockFocus={(id) => setState(prev => ({ ...prev, activeBlock: id }))}
                        onBlockClick={handleBlockClick}
                        onBlockDoubleClick={handleBlockDoubleClick}
                        onBlockMouseDown={handleMouseDown}
                        selectedBlocks={state.selectedBlocks}
                        activeBlock={state.activeBlock}
                        blockRefs={blockRefs}
                        projectCharacters={characters}
                        projectElements={[]}
                        projectId={projectId}
                        screenplayId={screenplayId}
                        projectUniqueSceneHeadings={uniqueSceneHeadings}
                        onEnterAction={() => {}}
                        isProcessingSuggestion={isProcessingSuggestion}
                        setIsProcessingSuggestion={setIsProcessingSuggestion}
                        onDeselectAll={handleDeselectAll}
                        isCharacterBlockAfterDialogue={isCharacterBlockAfterDialogue}
                        isSceneSelectionActive={isSceneSelectionActive}
                        addComment={(comment) => {
                          if (projectId && screenplayId) {
                            return addComment(projectId, screenplayId, comment);
                          }
                          return Promise.resolve(false);
                        }}
                        activeCommentId={activeCommentId}
                        onCommentSelect={(comment) => {
                          // Open comments panel if not already open
                          if (!showCommentsPanel) {
                            setShowCommentsPanel(true);
                          }
                          // Call the existing comment select handler
                          handleCommentSelect(comment);
                        }}
                        comments={state.comments}
                        showCommentsPanel={showCommentsPanel}
                        setShowCommentsPanel={setShowCommentsPanel}
                      />
                    ))}
                    
                    {/* Render collaborator cursors */}
                    <CollaboratorCursors 
                      cursors={collaborators}
                      blockRefs={blockRefs}
                    />
                  </div>
                </div>
              </div>
            </div>

            <FormatButtons
              isDarkMode={isDarkMode}
              activeBlock={state.activeBlock}
              onFormatChange={handleFormatChange}
              blocks={state.blocks}
              className="format-buttons"
            />
          </div>

        </div>

        {/* Fixed Comments Panel - Now with emoji reactions */}
        {showCommentsPanel && (
          <div className="fixed-comments-panel">
            <div className="fixed-comments-panel-content">
              <CommentsPanel
                comments={state.comments}
                activeBlock={state.activeBlock}
                activeCommentId={activeCommentId}
                onResolveComment={(commentId, isResolved) => {
                  if (projectId && screenplayId) {
                    resolveComment(commentId, isResolved, projectId, screenplayId);
                  } else {
                    resolveComment(commentId, isResolved);
                  }
                }}
                onCommentSelect={handleCommentSelect}
                commentCardRefs={commentCardRefs}
                blockPositions={blockPositions}
                editorScrollHeight={editorScrollHeight}
                ref={commentsScrollRef}
                onReplyToComment={handleReplyToComment}
                onToggleEmojiReaction={handleToggleEmojiReaction}
                onMentionUser={handleMentionUser}
                currentUserId={user?.id}
                currentUserName={user?.nickname || user?.firstName || user?.email || 'Anonymous'}
                projectId={projectId}
                screenplayId={screenplayId}
              />
            </div>
          </div>
        )}
      </div>

      {saveError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {saveError}
        </div>
      )}
    </div>
  );
};

export default ScreenplayEditor;