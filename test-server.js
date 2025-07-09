import WebSocket from 'ws'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

console.log('Testing Y.js WebSocket server...')

// Create a Y.js document
const ydoc = new Y.Doc()

// Connect to the WebSocket server
const provider = new WebsocketProvider('ws://localhost:1234', 'test-room', ydoc)

// Get a shared text type
const ytext = ydoc.getText('content')

// Listen for connection status
provider.on('status', (event) => {
  console.log('Connection status:', event.status)
})

// Listen for document changes
ytext.observe(() => {
  console.log('Document content:', ytext.toString())
})

// Wait for connection and then test
setTimeout(() => {
  console.log('Inserting test text...')
  ytext.insert(0, 'Hello from Y.js WebSocket server!')
  
  setTimeout(() => {
    console.log('Final content:', ytext.toString())
    provider.destroy()
    process.exit(0)
  }, 1000)
}, 1000)

// Handle errors
provider.on('connection-error', (error) => {
  console.error('Connection error:', error)
  process.exit(1)
})

// Timeout after 10 seconds
setTimeout(() => {
  console.error('Test timeout - server may not be running')
  process.exit(1)
}, 10000)
