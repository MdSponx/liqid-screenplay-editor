# Y.js WebSocket Server Setup

This is a basic WebSocket server for Y.js that enables real-time collaborative editing for your screenplay editor.

## Files Created

- `server.js` - The main WebSocket server file
- `server-package.json` - Package dependencies for the server
- `YJS_SERVER_README.md` - This setup guide

## Setup Instructions

### 1. Install Dependencies

First, you need to install the required dependencies. Since this is a separate server from your main React application, you'll need to install the Y.js dependencies:

```bash
# Install all required dependencies
npm install yjs y-websocket y-protocols lib0 ws
```

Or install them with specific versions:

```bash
npm install yjs@^13.6.10 y-websocket@^3.0.0 y-protocols@^1.0.5 lib0@^0.2.102 ws@^8.16.0
```

### 2. Start the Server

Run the WebSocket server:

```bash
node server.js
```

You should see output like:
```
Y.js WebSocket server running on port 1234
WebSocket URL: ws://localhost:1234
```

### 3. Connect from Your Frontend

In your React application, you can now connect to this WebSocket server using Y.js. Here's a basic example of how to connect:

```javascript
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

// Create a Y.js document
const ydoc = new Y.Doc()

// Connect to the WebSocket server
const provider = new WebsocketProvider('ws://localhost:1234', 'screenplay-room', ydoc)

// Get a shared type (e.g., for text collaboration)
const ytext = ydoc.getText('screenplay-content')

// Listen for changes
ytext.observe(() => {
  console.log('Document updated:', ytext.toString())
})
```

## Server Features

- **Real-time synchronization**: Multiple clients can connect and sync changes in real-time
- **In-memory storage**: Documents are stored in memory only (no persistence)
- **WebSocket connections**: Uses standard WebSocket protocol for communication
- **Graceful shutdown**: Handles SIGINT and SIGTERM signals properly
- **Error handling**: Includes basic error handling for connections and server errors

## Configuration

The server runs on port `1234` by default. You can modify the `PORT` constant in `server.js` if needed.

## Next Steps

1. **Frontend Integration**: Update your existing collaboration hooks to use this WebSocket server
2. **Room Management**: Implement room-based collaboration for different screenplays
3. **Persistence**: Add database persistence for document storage
4. **Authentication**: Add user authentication and authorization
5. **Scaling**: Consider using a process manager like PM2 for production

## Troubleshooting

- **Port already in use**: If port 1234 is already in use, change the `PORT` constant in `server.js`
- **Connection issues**: Make sure the server is running before connecting from the frontend
- **CORS issues**: The server accepts connections from any origin by default

## Production Considerations

For production deployment, consider:
- Using environment variables for configuration
- Adding proper logging
- Implementing authentication
- Adding rate limiting
- Using a reverse proxy (nginx)
- Adding SSL/TLS support
