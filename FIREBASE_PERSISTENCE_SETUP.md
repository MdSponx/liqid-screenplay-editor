# Y.js WebSocket Server with Firebase Realtime Database Persistence

This guide explains how to set up and use the enhanced Y.js WebSocket server with Firebase Realtime Database persistence.

## Overview

The enhanced server provides:
- **Primary Persistence**: LevelDB for fast local storage
- **Backup Persistence**: Firebase Realtime Database for cloud backup
- **Multi-document Support**: Each document identified by unique name
- **Automatic Backup**: Periodic backup to Firebase RTDB
- **Graceful Recovery**: Restore from LevelDB first, then Firebase if needed

## Architecture

```
Client ↔ Y.js WebSocket Server ↔ LevelDB (Primary) ↔ Firebase RTDB (Backup)
```

### Data Flow:
1. **Real-time Updates**: Client changes → Y.js Server → All connected clients
2. **Primary Persistence**: Y.js updates → LevelDB (immediate)
3. **Backup Persistence**: Y.js updates → Firebase RTDB (every 30 seconds)
4. **Recovery**: Server restart → Load from LevelDB → Fallback to Firebase if needed

## Installation

The required dependencies have been installed:

```bash
npm install y-leveldb firebase-admin level
```

### Dependencies:
- `y-leveldb`: Y.js persistence adapter for LevelDB
- `firebase-admin`: Firebase Admin SDK for server-side operations
- `level`: LevelDB database for Node.js

## Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Enable **Realtime Database**

### 2. Generate Service Account Key
1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Rename it to `firebase-service-account-key.json`
5. Place it in your server root directory

### 3. Configure Database URL
Update the database URL in `server-with-persistence.js`:

```javascript
databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/'
```

Replace `YOUR_PROJECT_ID` with your actual Firebase project ID.

### 4. Set Database Rules
Configure your Firebase Realtime Database rules:

```json
{
  "rules": {
    "yjs-documents": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$documentId": {
        ".validate": "newData.hasChildren(['content', 'metadata', 'timestamp'])"
      }
    }
  }
}
```

## Server Configuration

### Environment Variables (Optional)
```bash
export PORT=1234
export FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account-key.json
export LEVELDB_PATH=./yjs-leveldb
export FIREBASE_BACKUP_INTERVAL=30000
```

### Configuration Options in Code

```javascript
const PORT = process.env.PORT || 1234
const FIREBASE_BACKUP_INTERVAL = 30000 // 30 seconds
const LEVELDB_PATH = './yjs-leveldb'
const FIREBASE_SERVICE_ACCOUNT_PATH = './firebase-service-account-key.json'
```

## Running the Server

### Basic Server (No Persistence)
```bash
npm run start
# or
node server.js
```

### Enhanced Server (With Firebase Persistence)
```bash
npm run start:persistence
# or
node server-with-persistence.js
```

### Development Mode
```bash
npm run dev:persistence
```

## Server Features

### 1. Multi-Document Support
Each document is identified by its URL path:
- `ws://localhost:1234/my-screenplay-123`
- `ws://localhost:1234/project-456-draft`
- `ws://localhost:1234/shared-document`

### 2. Automatic Persistence
- **LevelDB**: Immediate persistence of all Y.js updates
- **Firebase**: Periodic backup every 30 seconds (configurable)
- **Metadata Tracking**: Document creation time, last modified, version

### 3. Document Recovery
Priority order for document recovery:
1. **LevelDB** (fastest, local)
2. **Firebase RTDB** (cloud backup)
3. **New Document** (if not found anywhere)

### 4. API Endpoints

#### Get Document List
```http
GET http://localhost:1234/api/documents
```

Response:
```json
{
  "documents": [
    {
      "name": "my-screenplay-123",
      "connections": 2,
      "metadata": {
        "created": "2024-01-15T10:30:00.000Z",
        "lastModified": "2024-01-15T11:45:00.000Z",
        "version": 15
      }
    }
  ],
  "totalDocuments": 1,
  "timestamp": "2024-01-15T11:45:30.000Z"
}
```

## Firebase Data Structure

Documents are stored in Firebase Realtime Database with this structure:

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

### Data Fields:
- **content**: Base64-encoded Y.js document state
- **metadata**: Document information (created, modified, version)
- **timestamp**: Firebase server timestamp

## Client Integration

### Frontend Usage
No changes needed in your frontend code. The persistence is transparent:

```javascript
// Same as before - persistence happens automatically
const provider = new WebsocketProvider(
  'ws://localhost:1234',
  'my-screenplay-123',  // Document ID
  ydoc
)
```

### Document Naming Strategy
Use meaningful document IDs:
```javascript
const documentId = `${projectId}-${screenplayId}`
const documentId = `user-${userId}-draft-${timestamp}`
const documentId = `shared-${teamId}-${documentName}`
```

## Monitoring and Logging

The server provides detailed logging:

```
✅ Firebase Admin SDK initialized successfully
📁 LevelDB persistence initialized at: ./yjs-leveldb
🔗 Setting up connection for document: "my-screenplay-123"
📁 Document "my-screenplay-123" restored from LevelDB
🔄 Document "my-screenplay-123" backed up to Firebase (version 15)
```

### Log Symbols:
- ✅ Success operations
- ❌ Error conditions
- ⚠️ Warnings
- 🔗 Connection events
- 📁 LevelDB operations
- 🔥 Firebase operations
- 🔄 Backup operations

## Error Handling

### Firebase Connection Issues
If Firebase is unavailable:
- Server continues with LevelDB only
- Warning logged but no service interruption
- Automatic retry on next update

### LevelDB Issues
If LevelDB fails:
- Fallback to Firebase for document recovery
- New documents created in memory
- Error logged for investigation

### Network Issues
- Automatic WebSocket reconnection
- Document state preserved in persistence layers
- Graceful degradation of service

## Performance Considerations

### LevelDB Performance
- Fast read/write operations
- Efficient for frequent updates
- Local storage, no network latency

### Firebase Backup Strategy
- Batched updates every 30 seconds
- Prevents excessive API calls
- Configurable backup interval

### Memory Management
- Documents removed from memory after 30 seconds of inactivity
- Final backup before cleanup
- Automatic garbage collection

## Security Considerations

### Firebase Security
- Service account key should be kept secure
- Database rules restrict access to authenticated users
- Consider implementing custom authentication

### Server Security
- Run server behind reverse proxy (nginx)
- Use HTTPS/WSS in production
- Implement rate limiting
- Validate document names to prevent path traversal

## Production Deployment

### Environment Setup
```bash
# Production environment variables
export NODE_ENV=production
export PORT=8080
export FIREBASE_SERVICE_ACCOUNT_PATH=/secure/path/service-account.json
export LEVELDB_PATH=/data/yjs-leveldb
```

### Process Management
Use PM2 or similar for production:

```bash
pm2 start server-with-persistence.js --name "yjs-server"
pm2 startup
pm2 save
```

### Backup Strategy
- Regular LevelDB directory backups
- Firebase provides automatic cloud backup
- Consider additional backup to cloud storage

## Troubleshooting

### Common Issues

#### 1. Firebase Connection Failed
```
❌ Failed to initialize Firebase Admin SDK: Error message
```
**Solution**: Check service account key file and database URL

#### 2. LevelDB Permission Error
```
❌ Error initializing document: EACCES: permission denied
```
**Solution**: Check file permissions for LevelDB directory

#### 3. Document Not Syncing
**Check**:
- WebSocket connection status
- Server logs for errors
- Firebase database rules
- Network connectivity

### Debug Mode
Enable detailed logging:

```javascript
// Add to server-with-persistence.js
const DEBUG = process.env.DEBUG === 'true'

if (DEBUG) {
  console.log('Debug mode enabled')
  // Additional debug logging
}
```

## Migration from Basic Server

### Step 1: Backup Existing Data
If you have existing documents, they're in memory only. Connect clients to save current state.

### Step 2: Update Server
Replace `server.js` with `server-with-persistence.js` or run both in parallel.

### Step 3: Configure Firebase
Set up Firebase project and service account as described above.

### Step 4: Test Migration
1. Start new server
2. Connect clients
3. Verify documents are persisted
4. Test recovery after server restart

## API Reference

### FirebaseBackupManager Class

```javascript
class FirebaseBackupManager {
  async backupDocument(docName, ydoc)     // Backup document to Firebase
  async restoreDocument(docName)          // Restore document from Firebase
  scheduleBackup(docName)                 // Schedule backup for document
  async processBackupQueue()              // Process all pending backups
}
```

### Document Management

```javascript
async function getOrCreateDocument(docName, gc = true)
// Returns Y.js document with persistence binding
```

This enhanced Y.js server provides robust persistence with Firebase Realtime Database backup, ensuring your collaborative documents are never lost while maintaining high performance through local LevelDB storage.
