import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { Comment, UserMention } from '../../types';
import CommentCard from './CommentCard';
import ChatThreadComments from './ChatThreadComments';
import { MessageSquare, Filter, X, Plus, Layers, ArrowLeft } from 'lucide-react';

interface CommentsPanelProps {
  comments: Comment[];
  activeBlock: string | null;
  activeCommentId: string | null;
  onResolveComment: (commentId: string, isResolved: boolean) => void;
  onCommentSelect: (comment: Comment) => void;
  commentCardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  blockPositions: Record<string, number>;
  editorScrollHeight: number;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  onReplyToComment?: (commentId: string, replyText: string) => Promise<boolean>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<boolean>;
  onToggleEmojiReaction?: (commentId: string, emoji: string, userName: string) => Promise<boolean>;
  onMentionUser?: (searchTerm: string) => Promise<UserMention[]>;
  currentUserId?: string;
  currentUserName?: string;
  projectId?: string;
  screenplayId?: string;
}

const CommentsPanel = forwardRef<HTMLDivElement, CommentsPanelProps>(({ 
  comments, 
  activeBlock,
  activeCommentId,
  onResolveComment,
  onCommentSelect,
  commentCardRefs,
  blockPositions,
  editorScrollHeight,
  onScroll,
  onReplyToComment,
  onAddReaction,
  onToggleEmojiReaction,
  onMentionUser,
  currentUserId = 'current-user', // Default value for demo
  currentUserName = 'Current User', // Default value for demo
  projectId,
  screenplayId
}, ref) => {
  const [showResolved, setShowResolved] = useState(false);
  const [filterByActiveBlock, setFilterByActiveBlock] = useState(false);
  const [useCompactMode, setUseCompactMode] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  
  // Helper function to flatten the comment tree for filtering
  const flattenComments = (comments: Comment[]): Comment[] => {
    let result: Comment[] = [];
    
    comments.forEach(comment => {
      result.push(comment);
      if (comment.replies && comment.replies.length > 0) {
        result = result.concat(flattenComments(comment.replies));
      }
    });
    
    return result;
  };
  
  // Filter comments based on resolved status and optionally activeBlock
  const filterComments = (comments: Comment[]): Comment[] => {
    // First, filter the top-level comments
    return comments.filter(comment => {
      const matchesResolved = showResolved || !comment.isResolved;
      const matchesBlock = !filterByActiveBlock || (activeBlock && comment.blockId === activeBlock);
      const shouldInclude = matchesResolved && matchesBlock;
      
      // If this comment should be included, also filter its replies
      if (shouldInclude && comment.replies && comment.replies.length > 0) {
        // Only include replies that match the resolved filter
        // (we don't filter replies by block since they belong to the same block as their parent)
        comment.replies = comment.replies.filter(reply => showResolved || !reply.isResolved);
        
        // Recursively filter nested replies
        comment.replies.forEach(reply => {
          if (reply.replies && reply.replies.length > 0) {
            reply.replies = filterComments([reply])[0]?.replies || [];
          }
        });
      }
      
      return shouldInclude;
    });
  };
  
  // Apply filters to comments
  const filteredComments = filterComments(comments);
  
  // Sort comments by their block positions to maintain logical order
  const sortedComments = [...filteredComments].sort((a, b) => {
    const posA = blockPositions[a.blockId] || 0;
    const posB = blockPositions[b.blockId] || 0;
    return posA - posB;
  });
  
  // Auto-detect compact mode based on comment density
  useEffect(() => {
    if (!ref || typeof ref === 'function') return;
    
    const commentCount = filteredComments.length;
    const availableHeight = ref.current?.clientHeight || 600;
    const shouldUseCompact = commentCount > Math.floor(availableHeight / 200);
    
    setUseCompactMode(shouldUseCompact);
  }, [filteredComments.length, ref]);
  
  // Handle opening a chat thread
  const handleOpenThread = (commentId: string) => {
    setActiveThreadId(commentId);
  };
  
  // Handle closing a chat thread
  const handleCloseThread = () => {
    setActiveThreadId(null);
  };
  
  // Find the active comment
  const activeComment = activeThreadId 
    ? comments.find(c => c.id === activeThreadId) 
    : null;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header with filters and compact mode toggle */}
      <div className="p-4 border-b border-[#577B92]/10 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900 flex-shrink-0">
        {activeThreadId ? (
          <div className="flex items-center">
            <button 
              onClick={handleCloseThread}
              className="p-1.5 rounded-lg mr-2 text-[#577B92] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft size={18} />
            </button>
            <h3 className="text-lg font-medium text-[#1E4D3A] dark:text-white">Discussion</h3>
          </div>
        ) : (
          <div className="flex items-center">
            <MessageSquare size={18} className="text-[#E86F2C] mr-2" />
            <h3 className="text-lg font-medium text-[#1E4D3A] dark:text-white">Comments</h3>
            <span className="ml-2 px-2 py-0.5 bg-[#E86F2C]/10 text-[#E86F2C] rounded-full text-xs">
              {flattenComments(filteredComments).length}
            </span>
          </div>
        )}
        
        {!activeThreadId && (
          <div className="flex items-center space-x-2">
            {/* Block filter toggle */}
            <button
              onClick={() => setFilterByActiveBlock(!filterByActiveBlock)}
              className={`p-1.5 rounded-lg transition-colors ${
                filterByActiveBlock
                  ? 'bg-[#E86F2C]/10 text-[#E86F2C]'
                  : 'text-[#577B92] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={filterByActiveBlock ? 'Show all comments' : 'Show comments for active block only'}
            >
              <X size={16} />
            </button>
            
            {/* Resolved filter toggle */}
            <button
              onClick={() => setShowResolved(!showResolved)}
              className={`p-1.5 rounded-lg transition-colors ${
                showResolved
                  ? 'bg-[#E86F2C]/10 text-[#E86F2C]'
                  : 'text-[#577B92] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={showResolved ? 'Hide resolved comments' : 'Show resolved comments'}
            >
              <Filter size={16} />
            </button>
            
            {/* Compact mode toggle */}
            <button
              onClick={() => setUseCompactMode(!useCompactMode)}
              className={`p-1.5 rounded-lg transition-colors ${
                useCompactMode
                  ? 'bg-[#E86F2C]/10 text-[#E86F2C]'
                  : 'text-[#577B92] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={useCompactMode ? 'Normal view' : 'Compact view'}
            >
              <Layers size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Comments List or Chat Thread */}
      <div 
        ref={ref} 
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-4"
      >
        {activeThreadId ? (
          // Chat Thread View
          <ChatThreadComments
            comments={activeComment ? [activeComment] : []}
            projectId={projectId}
            screenplayId={screenplayId}
            onReplyToComment={onReplyToComment || (() => Promise.resolve(false))}
            onToggleEmojiReaction={onToggleEmojiReaction || (() => Promise.resolve(false))}
            onMentionUser={onMentionUser}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onResolveComment={onResolveComment}
          />
        ) : (
          // Comments List View - Simplified to a standard vertical list
          <div className="space-y-4">
            {sortedComments.length > 0 ? (
              sortedComments.map(comment => (
                <div 
                  key={comment.id} 
                  ref={(el) => {
                    if (commentCardRefs) {
                      commentCardRefs.current[comment.id] = el;
                    }
                  }}
                  data-comment-id={comment.id}
                  onClick={() => onCommentSelect(comment)}
                  className="cursor-pointer"
                >
                  <CommentCard
                    comment={comment}
                    onResolve={onResolveComment}
                    isActive={comment.id === activeCommentId}
                    onReply={onReplyToComment}
                    onToggleEmojiReaction={onToggleEmojiReaction}
                    onMentionUser={onMentionUser}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    compactMode={useCompactMode}
                    onOpenThread={() => handleOpenThread(comment.id)}
                    hasReplies={comment.threadMessageCount ? comment.threadMessageCount > 0 : (comment.replies && comment.replies.length > 0)}
                  />
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-full bg-[#E86F2C]/10 dark:bg-[#E86F2C]/20 flex items-center justify-center mb-3">
                  <MessageSquare size={24} className="text-[#E86F2C]" />
                </div>
                <h4 className="text-[#1E4D3A] dark:text-white font-medium mb-1">No comments yet</h4>
                <p className="text-[#577B92] dark:text-gray-400 text-sm max-w-xs">
                  {comments.length === 0 
                    ? "Select text in a block and click the comment button to add a comment."
                    : showResolved 
                      ? "No comments match your filters."
                      : "No unresolved comments. Click the filter button to show resolved comments."}
                </p>
                <button className="mt-4 px-4 py-2 bg-[#E86F2C]/10 text-[#E86F2C] rounded-lg flex items-center hover:bg-[#E86F2C]/20 transition-colors">
                  <Plus size={16} className="mr-1" />
                  Add Comment
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Comment Button (Fixed at bottom) */}
      {filteredComments.length > 0 && !activeThreadId && (
        <div className="p-4 border-t border-[#577B92]/10 dark:border-gray-700 flex-shrink-0">
          <button className="w-full py-2 bg-[#E86F2C]/10 text-[#E86F2C] rounded-lg flex items-center justify-center hover:bg-[#E86F2C]/20 transition-colors">
            <Plus size={16} className="mr-1" />
            Add Comment
          </button>
        </div>
      )}
    </div>
  );
});

CommentsPanel.displayName = 'CommentsPanel';

export default CommentsPanel;