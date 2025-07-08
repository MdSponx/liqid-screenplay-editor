import React, { useState, useEffect } from 'react';
import { Save, Check, AlertCircle, Clock } from 'lucide-react';

interface OptimisticSaveButtonProps {
  onSave: () => Promise<{ success: boolean; error?: string }>;
  isSaving: boolean;
  hasChanges: boolean;
  pendingOperationsCount?: number;
  lastSyncTime?: Date | null;
  className?: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'syncing';

const OptimisticSaveButton: React.FC<OptimisticSaveButtonProps> = ({
  onSave,
  isSaving,
  hasChanges,
  pendingOperationsCount = 0,
  lastSyncTime,
  className = ''
}) => {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Determine current state based on props
  useEffect(() => {
    if (isSaving) {
      setSaveState('saving');
    } else if (pendingOperationsCount > 0) {
      setSaveState('syncing');
    } else if (!hasChanges && lastSyncTime) {
      setSaveState('saved');
    } else {
      setSaveState('idle');
    }
  }, [isSaving, pendingOperationsCount, hasChanges, lastSyncTime]);

  const handleSave = async () => {
    try {
      // Optimistic update - show saving state immediately
      setSaveState('saving');
      setErrorMessage('');

      const result = await onSave();
      
      if (result.success) {
        setSaveState('saved');
        // Reset to idle after showing success for 2 seconds
        setTimeout(() => {
          if (!hasChanges) {
            setSaveState('idle');
          }
        }, 2000);
      } else {
        setSaveState('error');
        setErrorMessage(result.error || 'Save failed');
        // Reset to idle after showing error for 3 seconds
        setTimeout(() => {
          setSaveState('idle');
        }, 3000);
      }
    } catch (error) {
      setSaveState('error');
      setErrorMessage('Network error occurred');
      setTimeout(() => {
        setSaveState('idle');
      }, 3000);
    }
  };

  const getButtonContent = () => {
    switch (saveState) {
      case 'saving':
        return (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Saving...</span>
          </>
        );
      
      case 'syncing':
        return (
          <>
            <Clock size={16} className="animate-pulse" />
            <span>Syncing ({pendingOperationsCount})</span>
          </>
        );
      
      case 'saved':
        return (
          <>
            <Check size={16} className="text-green-400" />
            <span>Saved</span>
          </>
        );
      
      case 'error':
        return (
          <>
            <AlertCircle size={16} className="text-red-400" />
            <span>Error</span>
          </>
        );
      
      default:
        return (
          <>
            <Save size={16} />
            <span>Save</span>
          </>
        );
    }
  };

  const getButtonStyles = () => {
    const baseStyles = `
      flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
      ${className}
    `;

    switch (saveState) {
      case 'saving':
        return `${baseStyles} bg-blue-500 text-white cursor-not-allowed`;
      
      case 'syncing':
        return `${baseStyles} bg-yellow-500 text-white cursor-not-allowed`;
      
      case 'saved':
        return `${baseStyles} bg-green-500 text-white cursor-default`;
      
      case 'error':
        return `${baseStyles} bg-red-500 text-white cursor-pointer hover:bg-red-600`;
      
      default:
        if (!hasChanges) {
          return `${baseStyles} bg-gray-300 text-gray-500 cursor-not-allowed`;
        }
        return `${baseStyles} bg-[#E86F2C] text-white hover:bg-[#d85f1c] cursor-pointer`;
    }
  };

  const isDisabled = saveState === 'saving' || saveState === 'syncing' || (!hasChanges && saveState !== 'error');

  return (
    <div className="relative">
      <button
        onClick={handleSave}
        disabled={isDisabled}
        className={getButtonStyles()}
        title={
          saveState === 'syncing' 
            ? `${pendingOperationsCount} operations pending sync`
            : saveState === 'error'
            ? errorMessage
            : saveState === 'saved' && lastSyncTime
            ? `Last saved: ${lastSyncTime.toLocaleTimeString()}`
            : undefined
        }
      >
        {getButtonContent()}
      </button>

      {/* Error tooltip */}
      {saveState === 'error' && errorMessage && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-red-600 text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
          {errorMessage}
          <div className="absolute bottom-full left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-600"></div>
        </div>
      )}

      {/* Sync status indicator */}
      {pendingOperationsCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
          {pendingOperationsCount > 9 ? '9+' : pendingOperationsCount}
        </div>
      )}
    </div>
  );
};

export default OptimisticSaveButton;
