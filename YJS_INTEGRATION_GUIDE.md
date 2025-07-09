# Y.js Integration Guide for Frontend Editor

This guide explains how to integrate Y.js with your frontend editor component for real-time collaborative editing.

## Overview

The integration includes:
- **Y.js** for conflict-free replicated data types (CRDTs)
- **TipTap** as the rich text editor with Y.js support
- **WebSocket Provider** for real-time synchronization
- **Collaborative cursors** to show other users' positions

## Installation

The necessary packages have been installed:

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor
```

Y.js packages were already installed:
- `yjs` - Core Y.js library
- `y-websocket` - WebSocket provider for Y.js
- `y-protocols` - Y.js protocols
- `lib0` - Utility library for Y.js

## Components Created

### 1. YjsEditor Component (`src/components/YjsEditor.tsx`)

A reusable TipTap editor with Y.js integration:

**Features:**
- Real-time collaborative editing
- Collaborative cursors showing other users
- Connection status indicator
- Basic formatting toolbar
- Automatic conflict resolution

**Props:**
```typescript
interface YjsEditorProps {
  documentId: string;        // Unique document identifier
  userId: string;           // Current user ID
  userName: string;         // Current user display name
  userColor?: string;       // User cursor color (default: #E86F2C)
  className?: string;       // Additional CSS classes
  placeholder?: string;     // Editor placeholder text
  onContentChange?: (content: string) => void; // Content change callback
  websocketUrl?: string;    // WebSocket server URL (default: ws://localhost:1234)
}
```

**Usage:**
```tsx
<YjsEditor
  documentId="my-document-123"
  userId={user.id}
  userName={user.name}
  userColor="#E86F2C"
  placeholder="Start writing..."
  onContentChange={(content) => console.log('Content changed:', content)}
  websocketUrl="ws://localhost:1234"
/>
```

### 2. ScreenplayEditorWithYjs Component (`src/components/ScreenplayEditorWithYjs.tsx`)

A complete screenplay editor integrated with Y.js:

**Features:**
- Full screenplay editor interface
- Y.js real-time collaboration
- Auto-save functionality
- Collaborator presence indicators
- Connection status monitoring
- Integration with existing ScreenplayNavigator

### 3. YjsDemo Component (`src/components/YjsDemo.tsx`)

A demonstration page showing two editor instances connected to the same document:

**Features:**
- Side-by-side editor comparison
- Real-time sync demonstration
- Testing instructions
- Server setup guidance

## Y.js Server Setup

You need a Y.js WebSocket server running to enable collaboration. Your project already has server files:

### Using the existing server:

1. **Check server files:**
   - `server.js` - Main Y.js WebSocket server
   - `test-server.js` - Test server implementation
   - `YJS_SERVER_README.md` - Server documentation

2. **Start the server:**
   ```bash
   node server.js
   ```
   or
   ```bash
   node test-server.js
   ```

3. **Server runs on:** `ws://localhost:1234`

## Integration Steps

### Step 1: Initialize Y.Doc and Provider

```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Create Y.js document
const ydoc = new Y.Doc();

// Create WebSocket provider
const provider = new WebsocketProvider(
  'ws://localhost:1234',  // WebSocket server URL
  'document-id',          // Unique document ID
  ydoc                    // Y.js document
);
```

### Step 2: Set up TipTap with Y.js Extensions

```typescript
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      history: false, // Disable default history (Y.js handles this)
    }),
    Collaboration.configure({
      document: ydoc,
    }),
    CollaborationCursor.configure({
      provider: provider,
      user: {
        name: userName,
        color: userColor,
      },
    }),
  ],
});
```

### Step 3: Handle Connection Status

```typescript
// Listen for connection status changes
provider.on('status', (event: { status: string }) => {
  setIsConnected(event.status === 'connected');
});

provider.on('connection-close', () => {
  setIsConnected(false);
});

provider.on('connection-error', (error: any) => {
  console.error('WebSocket connection error:', error);
  setIsConnected(false);
});
```

### Step 4: Set User Awareness

```typescript
// Set user information for collaborative cursors
provider.awareness.setLocalStateField('user', {
  name: userName,
  color: userColor,
  id: userId
});

// Listen for other users
provider.awareness.on('change', () => {
  const states = Array.from(provider.awareness.getStates().entries());
  const collaborators = states
    .filter(([clientId, state]) => clientId !== provider.awareness.clientID && state.user)
    .map(([clientId, state]) => ({
      id: clientId,
      user: state.user,
      cursor: state.cursor
    }));
  
  setCollaborators(collaborators);
});
```

## Key Features

### Real-time Synchronization
- Changes are automatically synced across all connected clients
- Conflict-free resolution using Y.js CRDTs
- Offline support with automatic sync when reconnected

### Collaborative Cursors
- See other users' cursor positions in real-time
- Different colors for different users
- User names displayed with cursors

### Connection Management
- Visual connection status indicator
- Automatic reconnection on connection loss
- Error handling for connection issues

### Auto-save Integration
- Content changes trigger auto-save after inactivity
- Integration with existing save mechanisms
- Proper error handling and user feedback

## Testing the Integration

### 1. Start the Y.js Server
```bash
node server.js
```

### 2. Open Multiple Browser Windows
- Navigate to your application
- Open the same document in multiple tabs/windows
- Start typing in one window
- Observe real-time updates in other windows

### 3. Test Collaborative Features
- Type simultaneously in different windows
- Try formatting text (bold, italic, headings)
- Observe cursor positions of other users
- Test connection loss/recovery

## Customization Options

### Custom Extensions
Add more TipTap extensions for additional functionality:

```typescript
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';

const editor = useEditor({
  extensions: [
    StarterKit,
    Collaboration.configure({ document: ydoc }),
    CollaborationCursor.configure({ provider, user }),
    Image,
    Link,
    // Add more extensions as needed
  ],
});
```

### Custom Styling
Modify the editor appearance:

```css
.yjs-editor .ProseMirror {
  /* Custom editor styles */
  font-family: 'Your Font';
  line-height: 1.6;
  padding: 20px;
}

.collaboration-cursor__caret {
  /* Custom cursor styles */
  border-left: 2px solid;
  margin-left: -1px;
}
```

### Server Configuration
Modify server settings in `server.js`:

```javascript
const port = process.env.PORT || 1234;
const host = process.env.HOST || 'localhost';

// Add authentication, room management, etc.
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure Y.js server is running
   - Check WebSocket URL is correct
   - Verify firewall/network settings

2. **Changes Not Syncing**
   - Check browser console for errors
   - Verify document IDs match across clients
   - Ensure Y.js extensions are properly configured

3. **Cursors Not Showing**
   - Verify CollaborationCursor extension is installed
   - Check user awareness is set correctly
   - Ensure provider is connected

### Debug Mode
Enable debug logging:

```typescript
// Add to your component
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    provider.on('status', console.log);
    provider.on('sync', console.log);
    ydoc.on('update', console.log);
  }
}, [provider, ydoc]);
```

## Production Considerations

### Security
- Implement authentication for WebSocket connections
- Add room-based access control
- Validate user permissions

### Scalability
- Use a production WebSocket server (not the simple test server)
- Consider using y-redis for persistence
- Implement proper error handling and monitoring

### Performance
- Optimize document size and structure
- Implement document cleanup for old/unused documents
- Consider pagination for large documents

## Next Steps

1. **Test the integration** using the demo components
2. **Customize the editor** to match your screenplay format requirements
3. **Integrate with your existing save system**
4. **Add authentication and authorization**
5. **Deploy with a production Y.js server**

The Y.js integration provides a solid foundation for real-time collaborative editing in your screenplay editor. The components are designed to be flexible and can be adapted to your specific requirements.
