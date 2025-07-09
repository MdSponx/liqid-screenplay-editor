import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync.js'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import { encoding, decoding, map } from 'lib0'
import { LeveldbPersistence } from 'y-leveldb'
import admin from 'firebase-admin'
import http from 'http'
import fs from 'fs'
import path from 'path'

const PORT = process.env.PORT || 1234
const FIREBASE_BACKUP_INTERVAL = 30000 // 30 seconds
const LEVELDB_PATH = './yjs-leveldb'
const IS_STACKBLITZ = process.env.STACKBLITZ === 'true'

// Firebase Admin SDK Configuration
// Replace with your Firebase service account key path
const FIREBASE_SERVICE_ACCOUNT_PATH = './firebase-service-account-key.json'

// Initialize Firebase Admin SDK
let firebaseApp = null
let firebaseDatabase = null

try {
  // Check if service account file exists
  if (fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
    const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'))
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://liqid-dd431-default-rtdb.firebaseio.com/'
    })
    
    firebaseDatabase = admin.database()
    console.log('✅ Firebase Admin SDK initialized successfully')
  } else {
    console.warn('⚠️  Firebase service account key not found. Running without Firebase persistence.')
    console.warn('   Create firebase-service-account-key.json to enable Firebase backup.')
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message)
  console.warn('   Running without Firebase persistence.')
}

// Initialize LevelDB persistence (skip in StackBlitz)
let persistence = null
if (!IS_STACKBLITZ) {
  try {
    persistence = new LeveldbPersistence(LEVELDB_PATH)
    console.log(`📁 LevelDB persistence initialized at: ${LEVELDB_PATH}`)
  } catch (error) {
    console.warn('⚠️  Failed to initialize LevelDB persistence:', error.message)
    console.warn('   Running without LevelDB persistence.')
  }
} else {
  console.log('📁 LevelDB persistence disabled in StackBlitz environment')
}

// Store Y.js documents and their metadata
const docs = new Map()
const docMetadata = new Map()

const messageSync = 0
const messageAwareness = 1

/**
 * Firebase Backup Functions
 */
class FirebaseBackupManager {
  constructor(database) {
    this.database = database
    this.backupQueue = new Set()
    this.isBackupRunning = false
  }

  async backupDocument(docName, ydoc) {
    if (!this.database) return

    try {
      // Convert Y.js document to binary format
      const update = Y.encodeStateAsUpdate(ydoc)
      const base64Update = Buffer.from(update).toString('base64')
      
      // Get document metadata
      const metadata = docMetadata.get(docName) || {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: 1
      }
      
      // Update metadata
      metadata.lastModified = new Date().toISOString()
      metadata.version = (metadata.version || 0) + 1
      docMetadata.set(docName, metadata)

      // Backup to Firebase Realtime Database
      const docRef = this.database.ref(`yjs-documents/${docName}`)
      await docRef.set({
        content: base64Update,
        metadata: metadata,
        timestamp: admin.database.ServerValue.TIMESTAMP
      })

      console.log(`🔄 Document "${docName}" backed up to Firebase (version ${metadata.version})`)
    } catch (error) {
      console.error(`❌ Failed to backup document "${docName}" to Firebase:`, error.message)
    }
  }

  async restoreDocument(docName) {
    if (!this.database) return null

    try {
      const docRef = this.database.ref(`yjs-documents/${docName}`)
      const snapshot = await docRef.once('value')
      
      if (snapshot.exists()) {
        const data = snapshot.val()
        const update = Buffer.from(data.content, 'base64')
        
        // Store metadata
        if (data.metadata) {
          docMetadata.set(docName, data.metadata)
        }
        
        console.log(`📥 Document "${docName}" restored from Firebase`)
        return update
      }
    } catch (error) {
      console.error(`❌ Failed to restore document "${docName}" from Firebase:`, error.message)
    }
    
    return null
  }

  scheduleBackup(docName) {
    this.backupQueue.add(docName)
    this.processBackupQueue()
  }

  async processBackupQueue() {
    if (this.isBackupRunning || this.backupQueue.size === 0) return

    this.isBackupRunning = true

    try {
      for (const docName of this.backupQueue) {
        const doc = docs.get(docName)
        if (doc) {
          await this.backupDocument(docName, doc)
        }
      }
      this.backupQueue.clear()
    } catch (error) {
      console.error('❌ Error processing backup queue:', error.message)
    } finally {
      this.isBackupRunning = false
    }
  }
}

const firebaseBackup = new FirebaseBackupManager(firebaseDatabase)

/**
 * Enhanced document management with persistence
 */
const getOrCreateDocument = async (docName, gc = true) => {
  if (docs.has(docName)) {
    return docs.get(docName)
  }

  // Create new Y.js document
  const ydoc = new Y.Doc()
  ydoc.gc = gc

  // Initialize connection tracking
  ydoc.conns = new Map()

  try {
    // Try to restore from LevelDB first
    if (persistence) {
      const persistedDoc = await persistence.getYDoc(docName)
      if (persistedDoc && Y.encodeStateAsUpdate(persistedDoc).length > 0) {
        Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedDoc))
        console.log(`📁 Document "${docName}" restored from LevelDB`)
      } else {
        // If not in LevelDB, try Firebase
        const firebaseUpdate = await firebaseBackup.restoreDocument(docName)
        if (firebaseUpdate) {
          Y.applyUpdate(ydoc, firebaseUpdate)
        } else {
          console.log(`📄 New document "${docName}" created`)
          // Set initial metadata for new documents
          docMetadata.set(docName, {
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            version: 1
          })
        }
      }
    } else {
      // No LevelDB, try Firebase only
      const firebaseUpdate = await firebaseBackup.restoreDocument(docName)
      if (firebaseUpdate) {
        Y.applyUpdate(ydoc, firebaseUpdate)
      } else {
        console.log(`📄 New document "${docName}" created`)
        // Set initial metadata for new documents
        docMetadata.set(docName, {
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: 1
        })
      }
    }

    // Set up persistence binding (only if LevelDB is available)
    if (persistence) {
      persistence.bindState(docName, ydoc)
    }

    // Set up periodic Firebase backup
    let backupTimer = null
    const scheduleFirebaseBackup = () => {
      if (backupTimer) clearTimeout(backupTimer)
      backupTimer = setTimeout(() => {
        firebaseBackup.scheduleBackup(docName)
      }, FIREBASE_BACKUP_INTERVAL)
    }

    // Listen for document updates to trigger backups
    ydoc.on('update', (update, origin) => {
      // Update metadata
      const metadata = docMetadata.get(docName) || {}
      metadata.lastModified = new Date().toISOString()
      docMetadata.set(docName, metadata)

      // Schedule Firebase backup
      scheduleFirebaseBackup()
    })

    // Store document
    docs.set(docName, ydoc)
    
    console.log(`✅ Document "${docName}" initialized with persistence`)
    return ydoc

  } catch (error) {
    console.error(`❌ Error initializing document "${docName}":`, error.message)
    
    // Fallback: create empty document
    docs.set(docName, ydoc)
    return ydoc
  }
}

/**
 * Setup a new client connection with enhanced persistence
 */
const setupWSConnection = async (conn, req, { docName = req.url.slice(1).split('?')[0], gc = true } = {}) => {
  conn.binaryType = 'arraybuffer'
  
  // Validate document name
  if (!docName || docName === '') {
    docName = 'default'
  }
  
  console.log(`🔗 Setting up connection for document: "${docName}"`)
  
  // Get or create document with persistence
  const doc = await getOrCreateDocument(docName, gc)
  
  // Add connection to document
  doc.conns.set(conn, new Set())

  // Listen to Yjs updates and broadcast to all connections
  const messageListener = (update, origin) => {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeUpdate(encoder, update)
    const message = encoding.toUint8Array(encoder)
    
    doc.conns.forEach((_, c) => {
      if (c !== conn && c.readyState === c.OPEN) {
        c.send(message, (err) => { 
          if (err) console.error(`❌ Error sending update to client:`, err.message) 
        })
      }
    })
  }
  doc.on('update', messageListener)

  // Setup awareness
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
    
    // Broadcast awareness update
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients))
    const buff = encoding.toUint8Array(encoder)
    
    doc.conns.forEach((_, c) => {
      if (c !== conn && c.readyState === c.OPEN) {
        c.send(buff, (err) => { 
          if (err) console.error(`❌ Error sending awareness update:`, err.message) 
        })
      }
    })
  }

  awareness.on('update', awarenessChangeHandler)

  // Send sync step 1
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, doc)
  conn.send(encoding.toUint8Array(encoder), (err) => { 
    if (err) console.error(`❌ Error sending sync step 1:`, err.message) 
  })
  
  // Send awareness states
  const awarenessStates = awareness.getStates()
  if (awarenessStates.size > 0) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())))
    conn.send(encoding.toUint8Array(encoder), (err) => { 
      if (err) console.error(`❌ Error sending awareness states:`, err.message) 
    })
  }

  // Handle incoming messages
  conn.on('message', (message) => {
    try {
      const decoder = decoding.createDecoder(message)
      const messageType = decoding.readVarUint(decoder)
      
      switch (messageType) {
        case messageSync: {
          const encoder = encoding.createEncoder()
          encoding.writeVarUint(encoder, messageSync)
          syncProtocol.readSyncMessage(decoder, encoder, doc, conn)
          if (encoding.length(encoder) > 1) {
            conn.send(encoding.toUint8Array(encoder), (err) => { 
              if (err) console.error(`❌ Error sending sync response:`, err.message) 
            })
          }
          break
        }
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), conn)
          break
        }
        default:
          console.warn(`⚠️  Unknown message type: ${messageType}`)
      }
    } catch (err) {
      console.error(`❌ Error processing message:`, err.message)
      doc.emit('error', [err])
    }
  })

  // Handle connection close
  conn.on('close', () => {
    console.log(`🔌 Connection closed for document: "${docName}"`)
    
    doc.conns.delete(conn)
    doc.off('update', messageListener)
    awareness.off('update', awarenessChangeHandler)
    
    // Clean up awareness states
    const connControlledIDs = doc.conns.get(conn)
    if (connControlledIDs) {
      awareness.removeAwarenessStates(Array.from(connControlledIDs), null)
    }
    
    // If no more connections, schedule cleanup
    if (doc.conns.size === 0) {
      setTimeout(() => {
        if (doc.conns.size === 0) {
          console.log(`🧹 Cleaning up document: "${docName}"`)
          
          // Final backup before cleanup
          firebaseBackup.scheduleBackup(docName)
          
          // Remove from memory after delay
          setTimeout(() => {
            if (doc.conns.size === 0) {
              docs.delete(docName)
              console.log(`🗑️  Document "${docName}" removed from memory`)
            }
          }, 60000) // 1 minute delay
        }
      }, 30000) // 30 seconds delay
    }
  })

  conn.on('error', (err) => {
    console.error(`❌ WebSocket error for document "${docName}":`, err.message)
  })

  console.log(`✅ Connection established for document: "${docName}"`)
}

// Create HTTP server
const server = http.createServer()

// Create WebSocket server
const wss = new WebSocketServer({ server })

// Handle WebSocket connections
wss.on('connection', async (ws, req) => {
  const docName = req.url.slice(1).split('?')[0] || 'default'
  console.log(`🔗 New WebSocket connection for document: "${docName}"`)
  
  try {
    await setupWSConnection(ws, req)
  } catch (error) {
    console.error(`❌ Error setting up WebSocket connection:`, error.message)
    ws.close(1011, 'Internal server error')
  }
})

// API endpoint to get document list
server.on('request', (req, res) => {
  if (req.method === 'GET' && req.url === '/api/documents') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    
    const documentList = Array.from(docs.keys()).map(docName => ({
      name: docName,
      connections: docs.get(docName)?.conns.size || 0,
      metadata: docMetadata.get(docName) || {}
    }))
    
    res.end(JSON.stringify({
      documents: documentList,
      totalDocuments: documentList.length,
      timestamp: new Date().toISOString()
    }))
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
})

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Y.js WebSocket server with Firebase persistence running on port ${PORT}`)
  console.log(`📡 WebSocket URL: ws://localhost:${PORT}`)
  console.log(`🌐 API endpoint: http://localhost:${PORT}/api/documents`)
  
  if (persistence) {
    console.log(`📁 LevelDB path: ${LEVELDB_PATH}`)
  } else {
    console.log(`📁 LevelDB persistence: disabled`)
  }
  
  if (firebaseDatabase) {
    console.log(`🔥 Firebase Realtime Database backup enabled`)
    console.log(`⏱️  Backup interval: ${FIREBASE_BACKUP_INTERVAL / 1000} seconds`)
  } else {
    console.log(`⚠️  Firebase backup disabled - check configuration`)
  }
})

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error.message)
})

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down Y.js WebSocket server...')
  
  // Close all WebSocket connections
  wss.clients.forEach((ws) => {
    ws.close(1001, 'Server shutting down')
  })
  
  // Final backup of all documents
  if (firebaseDatabase && docs.size > 0) {
    console.log('💾 Performing final backup of all documents...')
    for (const docName of docs.keys()) {
      await firebaseBackup.backupDocument(docName, docs.get(docName))
    }
  }
  
  // Close persistence
  try {
    if (persistence) {
      await persistence.destroy()
      console.log('📁 LevelDB persistence closed')
    }
  } catch (error) {
    console.error('❌ Error closing LevelDB:', error.message)
  }
  
  // Close server
  server.close(() => {
    console.log('✅ Server closed gracefully')
    process.exit(0)
  })
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⏰ Force exit after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message)
  gracefulShutdown()
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  gracefulShutdown()
})
