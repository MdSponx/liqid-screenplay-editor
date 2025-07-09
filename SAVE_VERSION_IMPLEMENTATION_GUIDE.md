# Save Version Feature Implementation Guide

This guide explains the complete implementation of the "Save Version" feature for Y.js collaborative documents with Firebase Firestore integration.

## Overview

The Save Version feature allows users to create versioned snapshots of their Y.js collaborative documents and store them in Cloud Firestore. This provides a complete version history system with the ability to view, download, and manage different versions of documents.

## Architecture

```
Y.js Document (RTDB) → Express API → Content Export → Firestore Versions Collection
```

### Data Flow:
1. **User Action**: User clicks "Save Version" button in frontend
2. **API Call**: Frontend sends POST request to Express API
3. **Document Retrieval**: API fetches Y.js document from Firebase Realtime Database
4. **Content Export**: Y.js document is converted to readable format (screenplay/plain/JSON)
5. **Version Storage**: Exported content is saved to Firestore versions subcollection
6. **Response**: API returns success with version metadata

## Implementation Components

### 1. Express API Server (`express-server.js`)

The main API server that handles version creation and retrieval.

#### Key Features:
- **Y.js Content Export**: Converts Y.js documents to multiple formats
- **Firebase Integration**: Connects to both RTDB and Firestore
- **Version Management**: Creates and manages version documents
- **Error Handling**: Comprehensive error handling and validation

#### API Endpoints:

```javascript
POST /api/screenplays/:docId/save-version
GET /api/screenplays/:docId/versions
GET /api/screenplays/:docId/versions/:versionId
GET /health
```

#### Content Export Formats:

1. **Screenplay Format** (default):
   ```javascript
   {
     format: 'screenplay',
     scenes: [
       {
         heading: 'INT. COFFEE SHOP - DAY',
         blocks: [
           { type: 'action', content: 'Scene description...' }
         ]
       }
     ],
     totalScenes: 3,
     wordCount: 250,
     rawContent: 'Full text content...'
   }
   ```

2. **Plain Text Format**:
   ```javascript
   "INT. COFFEE SHOP - DAY\n\nScene description..."
   ```

3. **JSON Format**:
   ```javascript
   {
     content: {
       'content': { type: 'text', content: '...', length: 500 }
     },
     documentSize: 1024,
     timestamp: '2024-01-15T10:30:00.000Z'
   }
   ```

### 2. Frontend Components

#### SaveVersionButton Component (`src/components/SaveVersionButton.tsx`)

Interactive button component for saving versions.

**Features:**
- **Quick Save**: One-click version saving with auto-generated names
- **Custom Save**: Dialog for custom version names and descriptions
- **Format Selection**: Choose export format (screenplay/plain/JSON)
- **Loading States**: Visual feedback during save operations
- **Error Handling**: User-friendly error messages

**Usage:**
```tsx
<SaveVersionButton
  docId="my-screenplay-123"
  projectId="project-456"
  userId="user-789"
  onVersionSaved={(data) => console.log('Version saved:', data)}
  onError={(error) => console.error('Save error:', error)}
  apiBaseUrl="http://localhost:3001"
/>
```

#### VersionHistory Component (`src/components/VersionHistory.tsx`)

Displays version history with preview and download capabilities.

**Features:**
- **Version List**: Shows all saved versions with metadata
- **Content Preview**: Inline preview of version content
- **Download**: Export versions in their original format
- **Format Icons**: Visual indicators for different export formats
- **Responsive Design**: Works on desktop and mobile

**Usage:**
```tsx
<VersionHistory
  docId="my-screenplay-123"
  apiBaseUrl="http://localhost:3001"
  onVersionSelect={(version) => console.log('Selected:', version)}
/>
```

#### VersioningDemo Component (`src/components/VersioningDemo.tsx`)

Complete demo showing Y.js editor with versioning capabilities.

**Features:**
- **Integrated Editor**: Y.js collaborative editor
- **Version Controls**: Save and history buttons
- **Status Indicators**: Server connection status
- **Instructions**: User guide for versioning features

### 3. Database Schema

#### Firestore Structure:

```
screenplays/{docId}
├── id: string
├── title: string
├── createdAt: timestamp
├── lastModified: timestamp
├── projectId: string
├── hasYjsContent: boolean
├── lastVersionCreated: timestamp
├── latestVersionId: string
├── versionCount: number
└── versions/{versionId}
    ├── versionName: string
    ├── description: string
    ├── format: 'screenplay' | 'plain' | 'json'
    ├── content: object | string
    ├── metadata: {
    │   ├── docId: string
    │   ├── projectId: string
    │   ├── createdBy: string
    │   ├── createdAt: timestamp
    │   ├── sourceTimestamp: number
    │   ├── sourceVersion: number
    │   └── exportTimestamp: string
    │   }
    └── stats: {
        ├── contentLength: number
        ├── wordCount: number
        └── sceneCount: number
        }
```

#### Firebase Realtime Database (Y.js Storage):

```json
{
  "yjs-documents": {
    "my-screenplay-123": {
      "content": "base64-encoded-yjs-update",
      "metadata": {
        "created": "2024-01-15T10:30:00.000Z",
        "lastModified": "2024-01-15T11:45:00.000Z",
        "version": 15
      },
      "timestamp": 1705318530000
    }
  }
}
```

## Setup Instructions

### 1. Install Dependencies

For Express server:
```bash
npm install express cors firebase-admin yjs
```

For frontend (if not already installed):
```bash
npm install lucide-react
```

### 2. Configure Firebase

1. **Service Account Setup**:
   ```bash
   # Copy template and fill with your credentials
   cp firebase-service-account-key.json.template firebase-service-account-key.json
   ```

2. **Update Database URL** in `express-server.js`:
   ```javascript
   databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/'
   ```

3. **Firestore Security Rules**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /screenplays/{screenplayId} {
         allow read, write: if request.auth != null;
         
         match /versions/{versionId} {
           allow read, write: if request.auth != null;
         }
       }
     }
   }
   ```

### 3. Start Servers

1. **Y.js WebSocket Server**:
   ```bash
   npm run start:persistence
   # or
   node server-with-persistence.js
   ```

2. **Express API Server**:
   ```bash
   # In express server directory
   npm install
   npm start
   # or
   node express-server.js
   ```

3. **Frontend Development Server**:
   ```bash
   npm run dev
   ```

## Usage Examples

### Basic Integration

```tsx
import React from 'react';
import SaveVersionButton from './components/SaveVersionButton';
import VersionHistory from './components/VersionHistory';
import YjsEditor from './components/YjsEditor';

const MyEditor = () => {
  const docId = 'my-document-123';
  const userId = 'user-456';
  const projectId = 'project-789';

  return (
    <div className="editor-container">
      {/* Main Editor */}
      <YjsEditor
        documentId={docId}
        userId={userId}
        userName="John Doe"
        websocketUrl="ws://localhost:1234"
      />
      
      {/* Version Controls */}
      <div className="version-controls">
        <SaveVersionButton
          docId={docId}
          userId={userId}
          projectId={projectId}
          onVersionSaved={(data) => {
            console.log('Version saved:', data.versionId);
            // Refresh version history or show success message
          }}
          onError={(error) => {
            console.error('Save failed:', error);
            // Show error message to user
          }}
        />
        
        <VersionHistory
          docId={docId}
          onVersionSelect={(version) => {
            console.log('Selected version:', version.versionName);
            // Handle version selection
          }}
        />
      </div>
    </div>
  );
};
```

### Advanced Usage with Custom Formats

```tsx
const handleCustomSave = async () => {
  try {
    const response = await fetch('/api/screenplays/my-doc/save-version', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionName: 'Final Draft v2.1',
        description: 'Incorporated director feedback',
        format: 'screenplay',
        userId: 'user-123',
        projectId: 'project-456'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('Version saved:', result.versionId);
    }
  } catch (error) {
    console.error('Save failed:', error);
  }
};
```

## Testing

### 1. API Testing

Run the comprehensive test suite:
```bash
node test-version-api.js
```

This tests:
- Health check endpoint
- Version creation with different formats
- Version retrieval and listing
- Content export functionality
- Error handling scenarios

### 2. Frontend Testing

Use the demo component:
```tsx
import VersioningDemo from './components/VersioningDemo';

// In your app
<VersioningDemo />
```

### 3. Manual Testing Checklist

- [ ] Create Y.js document with content
- [ ] Save version using Quick Save
- [ ] Save version with custom name and description
- [ ] View version history
- [ ] Preview version content
- [ ] Download version in different formats
- [ ] Test error scenarios (invalid document, network issues)

## Performance Considerations

### Content Export Optimization

1. **Large Documents**: For documents > 1MB, consider implementing streaming export
2. **Caching**: Cache exported content for frequently accessed versions
3. **Compression**: Use gzip compression for large text content

### Database Optimization

1. **Indexing**: Create Firestore indexes for version queries:
   ```javascript
   // Composite index for versions collection
   metadata.createdAt (desc) + metadata.createdBy (asc)
   ```

2. **Pagination**: Implement pagination for version lists:
   ```javascript
   const query = versionsRef
     .orderBy('metadata.createdAt', 'desc')
     .limit(10)
     .startAfter(lastVisible);
   ```

## Security Considerations

### API Security

1. **Authentication**: Implement proper user authentication
2. **Authorization**: Verify user permissions for document access
3. **Rate Limiting**: Prevent abuse of version creation
4. **Input Validation**: Sanitize all user inputs

### Firebase Security

1. **Service Account**: Keep service account key secure
2. **Database Rules**: Implement proper Firestore security rules
3. **CORS**: Configure CORS properly for production

## Troubleshooting

### Common Issues

1. **Version Save Fails**:
   - Check Y.js WebSocket server is running
   - Verify Firebase credentials are correct
   - Check document exists in RTDB

2. **Content Export Empty**:
   - Ensure Y.js document has content
   - Check Y.js text key names match export logic
   - Verify document persistence is working

3. **Frontend Errors**:
   - Check API server is running on correct port
   - Verify CORS configuration
   - Check browser console for detailed errors

### Debug Mode

Enable debug logging in Express server:
```javascript
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  console.log('Debug: Y.js document state:', Y.encodeStateAsUpdate(ydoc));
  console.log('Debug: Exported content:', exportedContent);
}
```

## Production Deployment

### Environment Variables

```bash
NODE_ENV=production
PORT=3001
FIREBASE_SERVICE_ACCOUNT_PATH=/secure/path/service-account.json
CORS_ORIGIN=https://yourdomain.com
```

### Process Management

Use PM2 for production:
```bash
pm2 start express-server.js --name "version-api"
pm2 startup
pm2 save
```

### Monitoring

Implement logging and monitoring:
```javascript
// Add to express-server.js
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'version-api.log' })
  ]
});
```

This Save Version implementation provides a complete versioning system for Y.js collaborative documents, enabling users to create, manage, and access historical versions of their work with full integration between Y.js real-time editing and Firebase persistence.
