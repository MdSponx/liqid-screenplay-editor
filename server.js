import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync.js'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import { encoding, decoding, map } from 'lib0'
import http from 'http'

const PORT = 1234

// Store Y.js documents in memory
const docs = new Map()
const conns = new Map()

const messageSync = 0
const messageAwareness = 1

/**
 * Setup a new client connection
 */
const setupWSConnection = (conn, req, { docName = req.url.slice(1).split('?')[0], gc = true } = {}) => {
  conn.binaryType = 'arraybuffer'
  
  // Get or create document
  const doc = map.setIfUndefined(docs, docName, () => {
    const ydoc = new Y.Doc()
    ydoc.gc = gc
    if (docs.has(docName)) {
      return docs.get(docName)
    }
    docs.set(docName, ydoc)
    return ydoc
  })

  doc.conns.set(conn, new Set())

  // Listen to Yjs updates and broadcast to all connections
  const messageListener = (update, origin) => {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeUpdate(encoder, update)
    const message = encoding.toUint8Array(encoder)
    doc.conns.forEach((_, c) => {
      if (c !== conn && c.readyState === conn.OPEN) {
        c.send(message, (err) => { if (err) console.error(err) })
      }
    })
  }
  doc.on('update', messageListener)

  // Listen to awareness updates
  let awareness = doc.awareness
  if (!awareness) {
    awareness = new awarenessProtocol.Awareness(doc)
    doc.awareness = awareness
  }

  const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
    const changedClients = added.concat(updated, removed)
    if (conn !== null) {
      const connControlledIDs = doc.conns.get(conn)
      if (connControlledIDs !== undefined) {
        added.forEach((clientID) => { connControlledIDs.add(clientID) })
        removed.forEach((clientID) => { connControlledIDs.delete(clientID) })
      }
    }
    // broadcast awareness update
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients))
    const buff = encoding.toUint8Array(encoder)
    doc.conns.forEach((_, c) => {
      if (c !== conn && c.readyState === conn.OPEN) {
        c.send(buff, (err) => { if (err) console.error(err) })
      }
    })
  }

  awareness.on('update', awarenessChangeHandler)

  // Send sync step 1
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, doc)
  conn.send(encoding.toUint8Array(encoder), (err) => { if (err) console.error(err) })
  
  const awarenessStates = awareness.getStates()
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())))
    conn.send(encoding.toUint8Array(encoder), (err) => { if (err) console.error(err) })
  }

  // Handle incoming messages
  conn.on('message', (message) => {
    try {
      const decoder = decoding.createDecoder(message)
      const messageType = decoding.readVarUint(decoder)
      switch (messageType) {
        case messageSync:
          encoding.writeVarUint(encoder, messageSync)
          syncProtocol.readSyncMessage(decoder, encoder, doc, conn)
          if (encoding.length(encoder) > 1) {
            conn.send(encoding.toUint8Array(encoder), (err) => { if (err) console.error(err) })
          }
          break
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), conn)
          break
        }
      }
    } catch (err) {
      console.error(err)
      doc.emit('error', [err])
    }
  })

  // Handle connection close
  conn.on('close', () => {
    doc.conns.delete(conn)
    doc.off('update', messageListener)
    awareness.off('update', awarenessChangeHandler)
    if (doc.conns.size === 0) {
      // If this is the last connection, remove the document after a delay
      setTimeout(() => {
        if (doc.conns.size === 0) {
          docs.delete(docName)
        }
      }, 30000) // 30 seconds delay
    }
    awareness.removeAwarenessStates(Array.from(doc.conns.get(conn) || []), null)
  })

  conn.on('error', (err) => {
    console.error('WebSocket error:', err)
  })
}

// Create HTTP server
const server = http.createServer()

// Create WebSocket server
const wss = new WebSocketServer({ server })

// Handle WebSocket connections for Y.js
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established')
  
  // Setup Y.js WebSocket connection
  setupWSConnection(ws, req)
  
  // Handle connection close
  ws.on('close', () => {
    console.log('WebSocket connection closed')
  })
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })
})

// Start the server
server.listen(PORT, () => {
  console.log(`Y.js WebSocket server running on port ${PORT}`)
  console.log(`WebSocket URL: ws://localhost:${PORT}`)
})

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Y.js WebSocket server...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('\nShutting down Y.js WebSocket server...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
