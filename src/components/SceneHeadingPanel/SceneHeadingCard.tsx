import React, { useState } from 'react';
import { Edit, Trash, MapPin, Link, FileText, Save, X } from 'lucide-react';
import { UniqueSceneHeadingDocument } from '../../types';

interface SceneHeadingCardProps {
  heading: UniqueSceneHeadingDocument;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<UniqueSceneHeadingDocument>) => void;
  onDelete: () => void;
  showDeleteConfirm: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

interface LocationData {
  actualLocation: string;
  mapUrl: string;
  description: string;
}

const SceneHeadingCard: React.FC<SceneHeadingCardProps> = ({
  heading,
  isEditing,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  showDeleteConfirm,
  onCancelDelete,
  onConfirmDelete
}) => {
  const [formData, setFormData] = useState<LocationData>({
    actualLocation: heading.actualLocation || '',
    mapUrl: heading.mapUrl || '',
    description: heading.description || ''
  });

  const [editedText, setEditedText] = useState(heading.text);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onUpdate({
      text: editedText,
      actualLocation: formData.actualLocation,
      mapUrl: formData.mapUrl,
      description: formData.description
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header with scene heading text */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        {isEditing ? (
          <div className="flex items-center">
            <input
              type="text"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#E86F2C] dark:bg-gray-700 dark:text-white"
            />
            <div className="flex ml-2">
              <button
                onClick={handleSave}
                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                title="Save"
              >
                <Save size={18} />
              </button>
              <button
                onClick={onCancelEdit}
                className="p-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                title="Cancel"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="font-mono font-bold text-gray-900 dark:text-white">
              {heading.text}
            </h3>
          </div>
        )}
      </div>

      {/* Second row with usage count and edit button */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <span className="px-2 py-0.5 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 text-xs rounded-full">
          Used {heading.count} {heading.count === 1 ? 'time' : 'times'}
        </span>
        {!isEditing && (
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Edit"
          >
            <Edit size={16} />
          </button>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300 mb-2">
            Are you sure you want to delete this scene heading? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={onCancelDelete}
              className="px-3 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmDelete}
              className="px-3 py-1 text-xs bg-red-500 text-white hover:bg-red-600 rounded"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Location details form */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Actual Location
              </label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="actualLocation"
                  value={formData.actualLocation}
                  onChange={handleChange}
                  placeholder="e.g., Paramount Studios, Stage 5"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#E86F2C] dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Google Maps URL
              </label>
              <div className="relative">
                <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="mapUrl"
                  value={formData.mapUrl}
                  onChange={handleChange}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#E86F2C] dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <div className="relative">
                <FileText size={16} className="absolute left-3 top-3 text-gray-400" />
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Add notes about this location..."
                  rows={3}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#E86F2C] dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex justify-start pt-2">
              <button
                onClick={onDelete}
                className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <div className="flex items-center">
                  <Trash size={14} className="mr-1" />
                  Delete
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start">
              <MapPin size={16} className="mt-0.5 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Actual Location</p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {heading.actualLocation || 'Not specified'}
                </p>
              </div>
            </div>
            
            {heading.mapUrl && (
              <div className="flex items-start">
                <Link size={16} className="mt-0.5 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Google Maps</p>
                  <a 
                    href={heading.mapUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    View Location
                  </a>
                </div>
              </div>
            )}
            
            {heading.description && (
              <div className="flex items-start">
                <FileText size={16} className="mt-0.5 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {heading.description}
                  </p>
                </div>
              </div>
            )}
            
            {!heading.actualLocation && !heading.mapUrl && !heading.description && (
              <button
                onClick={onEdit}
                className="w-full py-2 text-sm text-[#E86F2C] border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-[#E86F2C]/5"
              >
                + Add location details
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SceneHeadingCard;