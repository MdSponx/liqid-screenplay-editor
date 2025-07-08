import React, { useState, useEffect, useRef } from 'react';
import { Comment, CommentReaction, UserMention, EmojiReaction } from '../../types';
import { MessageSquare, Check, X, MoreVertical, Smile, MessageCircle, Users } from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface CommentCardProps {
  comment: Comment;
  onResolve: (commentId: string, isResolved: boolean) => void;
  isActive: boolean;
  onReply?: (commentId: string, replyText: string) => Promise<boolean>;
  onAddReaction?: (commentId: string, emoji: string) => Promise<boolean>;
  onToggleEmojiReaction?: (commentId: string, emoji: string, userName: string) => Promise<boolean>;
  depth?: number;
  mentionedUsers?: UserMention[];
  onMentionUser?: (searchTerm: string) => Promise<UserMention[]>;
  currentUserId?: string;
  currentUserName?: string;
  compactMode?: boolean;
  onExpansionChange?: (commentId: string, isExpanding: boolean) => void;
  isExpanded?: boolean;
  onOpenThread?: () => void;
  hasReplies?: boolean;
}

interface UserProfile {
  profileImage?: string;
  firstName?: string;
  lastName?: string;
}

const CommentCard: React.FC<CommentCardProps> = ({ 
  comment, 
  onResolve, 
  isActive,
  onReply,
  onAddReaction,
  onToggleEmojiReaction,
  depth = 0,
  mentionedUsers = [],
  onMentionUser,
  currentUserId = 'current-user', // Default value for demo
  currentUserName = 'Current User', // Default value for demo
  compactMode = false,
  onExpansionChange,
  isExpanded = false,
  onOpenThread,
  hasReplies = false
}) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<UserMention[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUsersData, setMentionedUsersData] = useState<UserMention[]>([]);
  const [showReactionsTooltip, setShowReactionsTooltip] = useState<string | null>(null);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Common emojis for quick selection
  const commonEmojis = ['👍', '👎', '❤️', '😂', '😮', '🎉', '👏', '🤔'];

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', comment.authorId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserProfile({
            profileImage: userData.profileImage,
            firstName: userData.firstName,
            lastName: userData.lastName
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
    
    // Fetch mentioned users data if the comment has mentions
    const fetchMentionedUsers = async () => {
      if (!comment.mentions || comment.mentions.length === 0) return;
      
      try {
        const usersRef = collection(db, 'users');
        const userPromises = comment.mentions.map(userId => 
          getDoc(doc(usersRef, userId))
        );
        
        const userDocs = await Promise.all(userPromises);
        const users: UserMention[] = userDocs
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
        
        setMentionedUsersData(users);
      } catch (error) {
        console.error('Error fetching mentioned users:', error);
      }
    };
    
    fetchMentionedUsers();
  }, [comment.authorId, comment.mentions]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Notify parent component when reply input is shown/hidden
  useEffect(() => {
    if (onExpansionChange) {
      onExpansionChange(comment.id, showReplyInput);
    }
  }, [showReplyInput, comment.id, onExpansionChange]);

  // Sync showReplyInput with isExpanded prop
  useEffect(() => {
    if (isExpanded !== undefined && showReplyInput !== isExpanded) {
      setShowReplyInput(isExpanded);
    }
  }, [isExpanded]);

  // Report card height changes to parent
  useEffect(() => {
    if (cardRef.current && onExpansionChange) {
      // Use ResizeObserver to detect height changes
      const resizeObserver = new ResizeObserver(() => {
        // Notify parent about expansion state changes
        onExpansionChange(comment.id, showReplyInput);
      });
      
      resizeObserver.observe(cardRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [comment.id, onExpansionChange, showReplyInput, showReplies]);

  // Format the timestamp for display
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      // Handle Firebase Timestamp
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      // Format as relative time if recent, otherwise as date
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined
      });
    } catch (err) {
      console.error('Error formatting date:', err);
      return 'Invalid date';
    }
  };

  // Format comment text with highlighted mentions
  const formatCommentText = (text: string) => {
    if (!comment.mentions || comment.mentions.length === 0) {
      return <span>{text}</span>;
    }
    
    // Replace @mentions with highlighted spans
    const mentionRegex = /@(\w+)/g;
    const parts = text.split(mentionRegex);
    
    if (parts.length <= 1) {
      return <span>{text}</span>;
    }
    
    return (
      <>
        {parts.map((part, index) => {
          // Even indices are regular text, odd indices are usernames
          if (index % 2 === 0) {
            return <span key={index}>{part}</span>;
          } else {
            // Find the user data for this mention
            const mentionedUser = mentionedUsersData.find(user => 
              user.displayName.toLowerCase() === part.toLowerCase() ||
              user.email.toLowerCase().startsWith(part.toLowerCase())
            );
            
            return (
              <span 
                key={index}
                className="mention"
                title={mentionedUser?.email || `@${part}`}
              >
                @{part}
              </span>
            );
          }
        })}
      </>
    );
  };

  // Truncate text with expand option
  const truncateText = (text: string, maxLength: number = compactMode ? 80 : 150) => {
    if (text.length <= maxLength || isTextExpanded) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  // Count total replies (including nested)
  const countTotalReplies = (comment: Comment): number => {
    if (!comment.replies) return 0;
    
    let count = comment.replies.length;
    comment.replies.forEach(reply => {
      count += countTotalReplies(reply);
    });
    
    return count;
  };

  const totalReplies = comment.threadMessageCount || countTotalReplies(comment);

  // Render emoji reactions
  const renderEmojiReactions = () => {
    if (!comment.emoji || comment.emoji.length === 0) return null;
    
    // Limit the number of reactions shown based on compact mode
    const displayLimit = compactMode ? 3 : 6;
    const visibleReactions = comment.emoji.slice(0, displayLimit);
    const hiddenCount = comment.emoji.length - displayLimit;
    
    return (
      <div className="flex flex-wrap gap-1 mb-3">
        {visibleReactions.map((reaction, index) => (
          <button 
            key={`${reaction.type}-${index}`}
            onClick={() => onToggleEmojiReaction && onToggleEmojiReaction(comment.id, reaction.type, currentUserName)}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs transition-colors ${
              reaction.users.includes(currentUserId)
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/30'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onMouseEnter={() => setShowReactionsTooltip(reaction.type)}
            onMouseLeave={() => setShowReactionsTooltip(null)}
          >
            <span className="mr-1">{reaction.type}</span>
            <span>{reaction.users.length}</span>
            
            {/* Tooltip showing who reacted */}
            {showReactionsTooltip === reaction.type && reaction.displayNames && (
              <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs z-10 min-w-[120px]">
                <div className="flex items-center mb-1 text-gray-500 dark:text-gray-400">
                  <Users size={12} className="mr-1" />
                  <span>Reactions</span>
                </div>
                <ul className="space-y-1">
                  {reaction.displayNames.map((name, i) => (
                    <li key={i} className="text-gray-700 dark:text-gray-300">
                      {name}
                    </li>
                  ))}
                </ul>
                <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700"></div>
              </div>
            )}
          </button>
        ))}
        
        {/* Show count of hidden reactions */}
        {hiddenCount > 0 && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            +{hiddenCount} more
          </span>
        )}
      </div>
    );
  };

  // Determine avatar size based on compact mode
  const avatarSize = compactMode ? 'w-7 h-7' : 'w-9 h-9';
  const textSize = compactMode ? 'text-sm' : 'text-base';
  const paddingClass = compactMode ? 'p-3' : 'p-4';

  return (
    <div 
      ref={cardRef}
      data-comment-id={comment.id}
      className={`comment-card mb-4 rounded-lg border transition-all duration-300 overflow-hidden ${
        isActive 
          ? 'border-[#E86F2C] ring-1 ring-[#E86F2C]/30 shadow-md'
          : comment.isResolved 
            ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-75' 
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md'
      } ${showReplyInput ? 'transform scale-[1.02]' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ fontSize: '15.3px' }}
    >
      {/* Highlighted Text Quote - Top of card */}
      {comment.highlightedText && (
        <div className={`px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 ${compactMode ? 'text-sm' : 'text-base'}`}>
          <div className="flex items-start space-x-2">
            <div className="w-1 h-4 bg-[#E86F2C] rounded-full flex-shrink-0 mt-0.5"></div>
            <blockquote className="italic text-gray-500 dark:text-gray-400 font-normal">
              "{truncateText(comment.highlightedText, compactMode ? 60 : 100)}"
            </blockquote>
          </div>
        </div>
      )}
      
      {/* Main Comment Content */}
      <div className={paddingClass}>
        {/* Header with user info and action buttons */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center min-w-0 flex-1">
            {/* User Profile Image */}
            <div className={`${avatarSize} rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0`}>
              <img
                src={userProfile?.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}&background=E86F2C&color=fff&size=32`}
                alt={comment.authorName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}&background=E86F2C&color=fff&size=32`;
                }}
              />
            </div>
            
            {/* User name and timestamp on same line */}
            <div className="ml-2 flex items-center space-x-1.5 min-w-0 flex-1">
              <span className={`comment-author font-medium truncate ${textSize} text-gray-900 dark:text-white`} style={{ fontSize: '15.3px' }}>
                {comment.authorName}
              </span>
              <span className="comment-time text-xs text-gray-400 dark:text-gray-500 flex-shrink-0" style={{ fontSize: '10.2px' }}>
                {formatDate(comment.createdAt)}
              </span>
            </div>
          </div>
          
          {/* Action buttons - Top right */}
          <div className="flex items-center space-x-1 ml-2">
            {/* Emoji reaction button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Add reaction"
            >
              <Smile size={compactMode ? 16 : 18} />
            </button>
            
            {/* Resolve/Unresolve button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResolve(comment.id, !comment.isResolved);
              }}
              className={`p-1 rounded-md transition-colors ${
                comment.isResolved
                  ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'text-gray-400 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={comment.isResolved ? 'Mark as unresolved' : 'Mark as resolved'}
            >
              {comment.isResolved ? (
                <X size={compactMode ? 16 : 18} />
              ) : (
                <Check size={compactMode ? 16 : 18} />
              )}
            </button>
            
            {/* More options button */}
            <button
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="More options"
            >
              <MoreVertical size={compactMode ? 16 : 18} />
            </button>
          </div>
        </div>
        
        {/* Comment text - Main body with formatted mentions */}
        <div className={`${showReplyInput ? 'mb-2' : 'mb-2'}`}>
          <p className={`comment-text ${textSize} leading-relaxed ${
            comment.isResolved 
              ? 'text-gray-500 dark:text-gray-400' 
              : 'text-gray-900 dark:text-white'
          }`} style={{ fontSize: '15.3px' }}>
            {formatCommentText(truncateText(comment.text))}
            
            {/* Show "more" button if text is truncated */}
            {!isTextExpanded && comment.text.length > (compactMode ? 80 : 150) && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTextExpanded(true);
                }}
                className="ml-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                more
              </button>
            )}
          </p>
        </div>

        {/* Emoji Reactions */}
        {renderEmojiReactions()}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div 
            ref={emojiPickerRef}
            className="mb-2 p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg"
          >
            <div className="flex flex-wrap gap-1">
              {commonEmojis.map(emoji => (
                <button 
                  key={emoji}
                  className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors text-lg ${
                    comment.emoji?.some(reaction => reaction.type === emoji && reaction.users.includes(currentUserId))
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  onClick={() => onToggleEmojiReaction && onToggleEmojiReaction(comment.id, emoji, currentUserName)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Thread button and replies count */}
        <div className="flex items-center justify-between">
          {/* Thread button - appears on hover or if there are replies */}
          {(isHovered || hasReplies) && !comment.isResolved && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenThread) {
                  onOpenThread();
                }
              }}
              className={`text-xs text-gray-500 dark:text-gray-400 hover:text-[#E86F2C] dark:hover:text-[#E86F2C] transition-colors flex items-center`}
              style={{ fontSize: '12.75px' }}
            >
              <MessageCircle size={16} className="mr-1" />
              {hasReplies ? (
                <span>View thread ({totalReplies})</span>
              ) : (
                <span>Reply in thread</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentCard;