import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Edit, Trash, MapPin, Link, FileText, 
  Save, X, AlertCircle, Check, ChevronDown, ChevronUp
} from 'lucide-react';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UniqueSceneHeadingDocument } from '../../types';
import SceneHeadingCard from './SceneHeadingCard';

interface SceneHeadingPanelProps {
  projectId: string;
  screenplayId?: string;
}

const SceneHeadingPanel: React.FC<SceneHeadingPanelProps> = ({ projectId, screenplayId }) => {
  const [sceneHeadings, setSceneHeadings] = useState<UniqueSceneHeadingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingHeadingId, setEditingHeadingId] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortField, setSortField] = useState<'text' | 'count'>('text');

  useEffect(() => {
    fetchSceneHeadings();
  }, [projectId]);

  const fetchSceneHeadings = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      const sceneHeadingsRef = collection(db, `projects/${projectId}/unique_scene_headings`);
      let headings: UniqueSceneHeadingDocument[] = [];
      
      if (screenplayId) {
        // For screenplay-specific queries, we need to handle the composite index requirement
        // First, try the optimized query with composite index
        try {
          const sceneHeadingsQuery = query(
            sceneHeadingsRef,
            where("screenplayIds", "array-contains", screenplayId),
            orderBy(sortField === 'text' ? "text_uppercase" : "count", sortOrder)
          );
          const querySnapshot = await getDocs(sceneHeadingsQuery);
          headings = querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as UniqueSceneHeadingDocument[];
        } catch (indexError) {
          // If composite index doesn't exist, fall back to client-side filtering and sorting
          console.warn('Composite index not available, falling back to client-side processing:', indexError);
          
          // Fetch all scene headings and filter client-side
          const fallbackQuery = query(sceneHeadingsRef);
          const querySnapshot = await getDocs(fallbackQuery);
          const allHeadings = querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as UniqueSceneHeadingDocument[];
          
          // Filter for the specific screenplay
          headings = allHeadings.filter(heading => 
            heading.screenplayIds && heading.screenplayIds.includes(screenplayId)
          );
          
          // Sort client-side
          headings.sort((a, b) => {
            let aValue, bValue;
            if (sortField === 'text') {
              aValue = a.text_uppercase || a.text.toUpperCase();
              bValue = b.text_uppercase || b.text.toUpperCase();
            } else {
              aValue = a.count || 0;
              bValue = b.count || 0;
            }
            
            if (sortOrder === 'asc') {
              return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
              return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
          });
        }
      } else {
        // For project-wide queries, use simple orderBy (no composite index needed)
        const sceneHeadingsQuery = query(
          sceneHeadingsRef,
          orderBy(sortField === 'text' ? "text_uppercase" : "count", sortOrder)
        );
        const querySnapshot = await getDocs(sceneHeadingsQuery);
        headings = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as UniqueSceneHeadingDocument[];
      }

      setSceneHeadings(headings);
    } catch (err) {
      console.error('Error fetching scene headings:', err);
      setError('Failed to load scene headings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSceneHeading = async (
    id: string, 
    updates: Partial<UniqueSceneHeadingDocument>
  ) => {
    if (!projectId) return;

    try {
      const headingRef = doc(db, `projects/${projectId}/unique_scene_headings`, id);
      
      // If text is being updated, also update text_uppercase
      if (updates.text) {
        updates.text_uppercase = updates.text.toUpperCase();
      }
      
      await updateDoc(headingRef, updates);
      
      // Update local state
      setSceneHeadings(prev => 
        prev.map(heading => 
          heading.id === id ? { ...heading, ...updates } : heading
        )
      );
      
      setEditingHeadingId(null);
    } catch (err) {
      console.error('Error updating scene heading:', err);
      setError('Failed to update scene heading. Please try again.');
    }
  };

  const handleDeleteSceneHeading = async (id: string) => {
    if (!projectId) return;

    try {
      const headingRef = doc(db, `projects/${projectId}/unique_scene_headings`, id);
      await deleteDoc(headingRef);
      
      // Update local state
      setSceneHeadings(prev => prev.filter(heading => heading.id !== id));
      setShowConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting scene heading:', err);
      setError('Failed to delete scene heading. Please try again.');
    }
  };

  const toggleSort = (field: 'text' | 'count') => {
    if (sortField === field) {
      // Toggle order if clicking the same field
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
    
    // Re-fetch data with new sort parameters
    fetchSceneHeadings();
  };

  const filteredHeadings = sceneHeadings.filter(heading => 
    heading.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search scene headings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 border-none rounded-lg focus:ring-2 focus:ring-[#E86F2C] focus:bg-white dark:focus:bg-gray-800"
            />
          </div>
        </div>

        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {filteredHeadings.length} Scene Headings
          </h3>
          <div className="flex space-x-2">
            <button 
              onClick={() => toggleSort('text')}
              className="flex items-center text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Name {sortField === 'text' && (sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />)}
            </button>
            <button 
              onClick={() => toggleSort('count')}
              className="flex items-center text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Usage {sortField === 'count' && (sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />)}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center text-red-700 dark:text-red-400">
            <AlertCircle size={16} className="mr-2" />
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-8 h-8 border-4 border-[#E86F2C] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredHeadings.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No scene headings match your search' : 'No scene headings found'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredHeadings.map(heading => (
              <SceneHeadingCard
                key={heading.id}
                heading={heading}
                isEditing={editingHeadingId === heading.id}
                onEdit={() => setEditingHeadingId(heading.id)}
                onCancelEdit={() => setEditingHeadingId(null)}
                onUpdate={(updates) => handleUpdateSceneHeading(heading.id, updates)}
                onDelete={() => setShowConfirmDelete(heading.id)}
                showDeleteConfirm={showConfirmDelete === heading.id}
                onCancelDelete={() => setShowConfirmDelete(null)}
                onConfirmDelete={() => handleDeleteSceneHeading(heading.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SceneHeadingPanel;