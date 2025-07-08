import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, AtSign, User } from 'lucide-react';
import { Comment, UserMention, ThreadMessage } from '../../types';
import { Timestamp } from 'firebase/firestore';
import { useThreadMessages } from '../../hooks/useThreadMessages';

interface ChatThreadCommentsProps {
  comments: Comment[];
  projectId?: string;
  screenplayId?: string;
  onReplyToComment: (commentId: string, replyText: string) => Promise<boolean>;
  onToggleEmojiReaction: (commentId: string, emoji: string, userName: string) => Promise<boolean>;
  onMentionUser?: (searchTerm: string) => Promise<UserMention[]>;
  currentUserId: string;
  currentUserName: string;
  onResolveComment: (commentId: string, isResolved: boolean) => void;
}

// Helper function to safely get timestamp in milliseconds
const getTimestampMillis = (timestamp: Timestamp | Date | undefined): number => {
  if (!timestamp) return 0;
  
  // If it's a Firestore Timestamp, use toMillis()
  if (timestamp && typeof timestamp.toMillis === 'function') {
    return timestamp.toMillis();
  }
  
  // If it's a Date object, use getTime()
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  
  // Fallback
  return 0;
};

// Helper function to extract mentions from text
const extractMentions = (text: string): string[] => {
  const mentions: string[] = [];
  const mentionRegex = /@(\w+)/g;
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
};

// Format timestamp for display
const formatTimestamp = (timestamp: Timestamp | Date | undefined): string => {
  if (!timestamp) return '';
  
  let date: Date;
  
  // Handle both Firestore Timestamp and Date objects
  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return '';
  }
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};

// Component to render message text with @mentions highlighted
const MessageText: React.FC<{ text: string }> = ({ text }) => {
  // Parse @mentions and render them as highlighted spans
  const parts = text.split(/(@\w+)/g);
  
  return (
    <div className="message-content">
      {parts.map((part, index) => {
        if (part.match(/@\w+/)) {
          return (
            <span key={index} className="mention-tag">
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
};

// Component to render a single chat message
const ChatMessage: React.FC<{
  message: ThreadMessage | Comment;
  isOwnMessage: boolean;
  originalAuthorId: string;
  originalAuthorName: string;
}> = ({ message, isOwnMessage, originalAuthorId, originalAuthorName }) => {
  const isOriginalAuthor = message.authorId === originalAuthorId;
  
  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'order-1' : 'order-2'}`}>
        {/* Avatar and name - only for others' messages */}
        {!isOwnMessage && (
          <div className="flex items-center space-x-2 mb-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
              isOriginalAuthor ? 'bg-purple-500' : 'bg-blue-500'
            }`}>
              {message.authorName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {message.authorName}
              {isOriginalAuthor && (
                <span className="ml-1 text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full">
                  Author
                </span>
              )}
            </span>
          </div>
        )}
        
        {/* Message bubble */}
        <div className={`px-4 py-2 rounded-2xl ${
          isOwnMessage 
            ? 'bg-blue-500 text-white rounded-br-sm' 
            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-bl-sm'
        }`}>
          {/* Message text with @mentions */}
          <MessageText text={message.text} />
          
          {/* Emoji reactions - compact inline */}
          {message.emoji && message.emoji.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.emoji.map(reaction => (
                <span 
                  key={reaction.type} 
                  className={`text-xs ${isOwnMessage ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-600'} px-1.5 py-0.5 rounded-full`}
                >
                  {reaction.type} {reaction.users.length}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Timestamp for own messages */}
        <div className={`text-xs text-gray-400 dark:text-gray-500 ${isOwnMessage ? 'text-right' : 'text-left'} mt-1`}>
          {formatTimestamp(message.createdAt)}
        </div>
      </div>
    </div>
  );
};

// Component for mention suggestions
const MentionSuggestions: React.FC<{
  users: UserMention[];
  onSelectUser: (user: UserMention) => void;
  position: { top: number; left: number };
}> = ({ users, onSelectUser, position }) => {
  if (users.length === 0) return null;
  
  return (
    <div 
      className="absolute z-10 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      {users.map(user => (
        <button
          key={user.id}
          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
          onClick={() => onSelectUser(user)}
        >
          {user.profileImage ? (
            <img src={user.profileImage} alt={user.displayName} className="w-6 h-6 rounded-full mr-2" />
          ) : (
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs mr-2">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">{user.displayName}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

// Main chat thread component
const ChatThreadComments: React.FC<ChatThreadCommentsProps> = ({
  comments,
  projectId,
  screenplayId,
  onReplyToComment,
  onToggleEmojiReaction,
  onMentionUser,
  currentUserId,
  currentUserName,
  onResolveComment
}) => {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<UserMention[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  
  // Common emojis for quick selection
  const commonEmojis = ['👍', '👎', '❤️', '😂', '😮', '🎉', '👏', '🤔'];
  
  // Get the original comment (first in the thread)
  const originalComment = comments.length > 0 ? comments[0] : null;
  
  // Use the thread messages hook to get messages from the subcollection
  const { 
    messages: threadMessages, 
    loading: messagesLoading, 
    error: messagesError,
    sendMessage
  } = useThreadMessages({
    projectId,
    screenplayId,
    commentId: originalComment?.id || null,
    enabled: !!originalComment
  });
  
  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [threadMessages.length]);
  
  // Handle input change with mention detection
  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setReplyText(value);
    
    // Check for @mention being typed
    const mentionMatch = value.match(/@(\w*)$/);
    if (mentionMatch) {
      const searchTerm = mentionMatch[1];
      setMentionSearch(searchTerm);
      
      if (searchTerm && onMentionUser) {
        try {
          const results = await onMentionUser(searchTerm);
          setMentionResults(results);
          setShowMentionPicker(results.length > 0);
          
          // Position the mention picker
          if (inputRef.current) {
            const cursorPosition = inputRef.current.selectionStart || 0;
            const textBeforeCursor = value.substring(0, cursorPosition);
            const lines = textBeforeCursor.split('\n');
            const currentLine = lines[lines.length - 1];
            const lineHeight = 24; // Approximate line height
            
            setMentionPosition({
              top: -40 - (lines.length - 1) * lineHeight,
              left: currentLine.length * 8 // Approximate character width
            });
          }
        } catch (error) {
          console.error('Error searching for users:', error);
          setShowMentionPicker(false);
        }
      } else {
        setShowMentionPicker(false);
      }
    } else {
      setShowMentionPicker(false);
    }
  };
  
  // Handle selecting a user from mention suggestions
  const handleSelectMention = (user: UserMention) => {
    const mentionRegex = /@\w*$/;
    const newText = replyText.replace(mentionRegex, `@${user.displayName} `);
    setReplyText(newText);
    setShowMentionPicker(false);
    
    // Focus back on input and place cursor at end
    if (inputRef.current) {
      inputRef.current.focus();
      const length = newText.length;
      inputRef.current.setSelectionRange(length, length);
    }
  };
  
  // Handle sending a reply
  const handleSendReply = async () => {
    if (!replyText.trim() || !originalComment) return;
    
    try {
      setIsSubmitting(true);
      
      // Extract mentions from text
      const mentions = extractMentions(replyText);
      
      // Use the new sendMessage function from useThreadMessages
      if (projectId && screenplayId) {
        const success = await sendMessage(replyText, currentUserId, currentUserName, mentions);
        
        if (success) {
          setReplyText('');
        }
      } else {
        // Fallback to old method during migration
        const success = await onReplyToComment(originalComment.id, replyText);
        
        if (success) {
          setReplyText('');
        }
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle emoji reaction
  const handleEmojiReaction = async (emoji: string) => {
    if (!selectedCommentId) return;
    
    try {
      await onToggleEmojiReaction(selectedCommentId, emoji, currentUserName);
      setShowEmojiPicker(false);
      setSelectedCommentId(null);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };
  
  // Handle keydown events in the input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
    
    // Close mention picker on Escape
    if (e.key === 'Escape' && showMentionPicker) {
      e.preventDefault();
      setShowMentionPicker(false);
    }
  };
  
  // Handle @mention button click
  const handleMentionButtonClick = () => {
    if (inputRef.current) {
      const cursorPos = inputRef.current.selectionStart || 0;
      const textBeforeCursor = replyText.substring(0, cursorPos);
      const textAfterCursor = replyText.substring(cursorPos);
      
      const newText = textBeforeCursor + '@' + textAfterCursor;
      setReplyText(newText);
      
      // Focus and set cursor position after the @
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursorPos = cursorPos + 1;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };
  
  // If there are no comments, show a placeholder
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <User size={24} className="text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No comments yet</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          Be the first to comment on this document. Select text and click the comment button to get started.
        </p>
      </div>
    );
  }
  
  // Show loading state while fetching thread messages
  if (messagesLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="w-8 h-8 border-4 border-[#E86F2C] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">Loading messages...</p>
      </div>
    );
  }
  
  // Show error state if there was a problem fetching messages
  if (messagesError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <span className="text-red-500 text-2xl">!</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error loading messages</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          {messagesError}
        </p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Thread header with original comment */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white">
            {originalComment?.authorName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {originalComment?.authorName}
                </span>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {formatTimestamp(originalComment?.createdAt)}
                </span>
              </div>
              <button
                onClick={() => originalComment && onResolveComment(originalComment.id, !originalComment.isResolved)}
                className={`px-2 py-1 text-xs rounded-full ${
                  originalComment?.isResolved
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-green-100 hover:text-green-800 dark:hover:bg-green-900/30 dark:hover:text-green-400'
                }`}
              >
                {originalComment?.isResolved ? 'Resolved' : 'Resolve'}
              </button>
            </div>
            <div className="mt-1 text-gray-800 dark:text-gray-200">
              <MessageText text={originalComment?.text || ''} />
            </div>
            {originalComment?.highlightedText && (
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded border-l-2 border-purple-500 text-sm text-gray-700 dark:text-gray-300 italic">
                "{originalComment.highlightedText}"
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Chat thread */}
      <div 
        ref={threadRef}
        className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800/50"
      >
        {threadMessages.length > 0 ? (
          threadMessages.map(message => (
            <ChatMessage
              key={message.id}
              message={message}
              isOwnMessage={message.authorId === currentUserId}
              originalAuthorId={originalComment?.authorId || ''}
              originalAuthorName={originalComment?.authorName || ''}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No replies yet. Be the first to reply!
          </div>
        )}
      </div>
      
      {/* Chat input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={replyText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply... Use @ to mention someone"
            className="w-full px-4 py-3 pr-24 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white resize-none"
            rows={2}
          />
          
          {/* Action buttons */}
          <div className="absolute right-3 bottom-3 flex space-x-2">
            <button
              onClick={handleMentionButtonClick}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Mention someone"
            >
              <AtSign size={18} />
            </button>
            <button
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setSelectedCommentId(originalComment?.id || null);
              }}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Add reaction"
            >
              <Smile size={18} />
            </button>
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim() || isSubmitting}
              className="p-1.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send reply"
            >
              <Send size={18} />
            </button>
          </div>
          
          {/* Mention suggestions */}
          {showMentionPicker && (
            <MentionSuggestions
              users={mentionResults}
              onSelectUser={handleSelectMention}
              position={mentionPosition}
            />
          )}
        </div>
        
        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="mt-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <div className="flex flex-wrap gap-2">
              {commonEmojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiReaction(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatThreadComments;