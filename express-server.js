import express from 'express'
import cors from 'cors'
import admin from 'firebase-admin'
import * as Y from 'yjs'
import { readFileSync } from 'fs'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Initialize Firebase Admin SDK (assuming it's already configured)
// If not already initialized, uncomment and configure:
/*
const serviceAccount = JSON.parse(readFileSync('./firebase-service-account-key.json', 'utf8'))
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/'
})
*/

const db = admin.firestore()
const rtdb = admin.database()

/**
 * Y.js Document Content Exporter
 * Converts Y.js document content to a readable format
 */
class YjsContentExporter {
  /**
   * Export Y.js document content to plain text
   * @param {Y.Doc} ydoc - Y.js document
   * @returns {string} Plain text content
   */
  static exportToPlainText(ydoc) {
    try {
      // Get the main text content (assuming it's stored in 'content' or 'default' key)
      const ytext = ydoc.getText('content') || ydoc.getText('default') || ydoc.getText()
      return ytext.toString()
    } catch (error) {
      console.error('Error exporting to plain text:', error)
      return ''
    }
  }

  /**
   * Export Y.js document content to structured JSON
   * @param {Y.Doc} ydoc - Y.js document
   * @returns {Object} Structured content object
   */
  static exportToJSON(ydoc) {
    try {
      const content = {}
      
      // Export all text types
      ydoc.share.forEach((value, key) => {
        if (value instanceof Y.Text) {
          content[key] = {
            type: 'text',
            content: value.toString(),
            length: value.length
          }
        } else if (value instanceof Y.Map) {
          content[key] = {
            type: 'map',
            content: value.toJSON()
          }
        } else if (value instanceof Y.Array) {
          content[key] = {
            type: 'array',
            content: value.toJSON()
          }
        }
      })

      return {
        content,
        documentSize: Y.encodeStateAsUpdate(ydoc).length,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error exporting to JSON:', error)
      return { content: {}, error: error.message }
    }
  }

  /**
   * Export Y.js document to screenplay-specific format
   * @param {Y.Doc} ydoc - Y.js document
   * @returns {Object} Screenplay-formatted content
   */
  static exportToScreenplayFormat(ydoc) {
    try {
      const mainText = ydoc.getText('content') || ydoc.getText('default') || ydoc.getText()
      const content = mainText.toString()
      
      // Parse screenplay content into structured format
      const lines = content.split('\n')
      const scenes = []
      let currentScene = null
      let currentBlock = null
      
      lines.forEach((line, index) => {
        const trimmedLine = line.trim()
        
        if (trimmedLine.toUpperCase().startsWith('INT.') || 
            trimmedLine.toUpperCase().startsWith('EXT.') ||
            trimmedLine.toUpperCase().includes('- DAY') ||
            trimmedLine.toUpperCase().includes('- NIGHT')) {
          // Scene heading
          if (currentScene) {
            scenes.push(currentScene)
          }
          currentScene = {
            heading: trimmedLine,
            blocks: [],
            lineNumber: index + 1
          }
        } else if (currentScene && trimmedLine) {
          // Scene content
          currentScene.blocks.push({
            type: 'action', // Could be enhanced to detect dialogue, action, etc.
            content: trimmedLine,
            lineNumber: index + 1
          })
        }
      })
      
      if (currentScene) {
        scenes.push(currentScene)
      }
      
      return {
        format: 'screenplay',
        scenes,
        totalScenes: scenes.length,
        totalLines: lines.length,
        wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
        characterCount: content.length,
        rawContent: content
      }
    } catch (error) {
      console.error('Error exporting to screenplay format:', error)
      return { format: 'screenplay', scenes: [], error: error.message }
    }
  }
}

/**
 * Save Version API Endpoint
 * POST /api/screenplays/:docId/save-version
 */
app.post('/api/screenplays/:docId/save-version', async (req, res) => {
  const { docId } = req.params
  const { 
    versionName, 
    description, 
    format = 'screenplay',
    userId,
    projectId 
  } = req.body

  try {
    console.log(`📝 Creating version for document: ${docId}`)

    // Step 1: Retrieve Y.js document from Firebase Realtime Database
    const rtdbRef = rtdb.ref(`yjs-documents/${docId}`)
    const snapshot = await rtdbRef.once('value')
    
    if (!snapshot.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Document not found in Realtime Database',
        docId
      })
    }

    const rtdbData = snapshot.val()
    console.log(`📥 Retrieved document from RTDB: ${docId}`)

    // Step 2: Reconstruct Y.js document from stored data
    const ydoc = new Y.Doc()
    
    if (rtdbData.content) {
      try {
        // Decode base64 content back to Y.js update
        const update = Buffer.from(rtdbData.content, 'base64')
        Y.applyUpdate(ydoc, update)
        console.log(`🔄 Applied Y.js update to document: ${docId}`)
      } catch (error) {
        console.error('Error applying Y.js update:', error)
        return res.status(500).json({
          success: false,
          error: 'Failed to reconstruct Y.js document',
          details: error.message
        })
      }
    }

    // Step 3: Export content based on requested format
    let exportedContent
    switch (format) {
      case 'plain':
        exportedContent = YjsContentExporter.exportToPlainText(ydoc)
        break
      case 'json':
        exportedContent = YjsContentExporter.exportToJSON(ydoc)
        break
      case 'screenplay':
      default:
        exportedContent = YjsContentExporter.exportToScreenplayFormat(ydoc)
        break
    }

    console.log(`📤 Exported content in ${format} format`)

    // Step 4: Create version document for Firestore
    const versionData = {
      versionName: versionName || `Version ${new Date().toISOString()}`,
      description: description || 'Auto-generated version',
      format,
      content: exportedContent,
      metadata: {
        docId,
        projectId: projectId || null,
        createdBy: userId || 'anonymous',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sourceTimestamp: rtdbData.timestamp || null,
        sourceVersion: rtdbData.metadata?.version || null,
        exportTimestamp: new Date().toISOString()
      },
      stats: {
        contentLength: typeof exportedContent === 'string' ? exportedContent.length : JSON.stringify(exportedContent).length,
        wordCount: exportedContent.wordCount || 0,
        sceneCount: exportedContent.totalScenes || 0
      }
    }

    // Step 5: Save to Firestore versions subcollection
    const screenplayRef = db.collection('screenplays').doc(docId)
    const versionsRef = screenplayRef.collection('versions')
    
    // Check if screenplay document exists
    const screenplayDoc = await screenplayRef.get()
    if (!screenplayDoc.exists) {
      // Create screenplay document if it doesn't exist
      await screenplayRef.set({
        id: docId,
        title: versionName || 'Untitled Screenplay',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModified: admin.firestore.FieldValue.serverTimestamp(),
        projectId: projectId || null,
        hasYjsContent: true
      }, { merge: true })
      console.log(`📄 Created screenplay document: ${docId}`)
    }

    // Save the version
    const versionRef = await versionsRef.add(versionData)
    console.log(`💾 Saved version to Firestore: ${versionRef.id}`)

    // Update screenplay document with latest version info
    await screenplayRef.update({
      lastVersionCreated: admin.firestore.FieldValue.serverTimestamp(),
      latestVersionId: versionRef.id,
      versionCount: admin.firestore.FieldValue.increment(1)
    })

    // Step 6: Return success response
    res.status(201).json({
      success: true,
      versionId: versionRef.id,
      docId,
      versionData: {
        ...versionData,
        metadata: {
          ...versionData.metadata,
          createdAt: new Date().toISOString() // Convert for JSON response
        }
      },
      message: 'Version saved successfully'
    })

    console.log(`✅ Version creation completed for document: ${docId}`)

  } catch (error) {
    console.error(`❌ Error creating version for document ${docId}:`, error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      docId
    })
  }
})

/**
 * Get Versions API Endpoint
 * GET /api/screenplays/:docId/versions
 */
app.get('/api/screenplays/:docId/versions', async (req, res) => {
  const { docId } = req.params
  const { limit = 10, orderBy = 'createdAt', order = 'desc' } = req.query

  try {
    const versionsRef = db.collection('screenplays').doc(docId).collection('versions')
    let query = versionsRef.orderBy(`metadata.${orderBy}`, order)
    
    if (limit) {
      query = query.limit(parseInt(limit))
    }

    const snapshot = await query.get()
    const versions = []

    snapshot.forEach(doc => {
      const data = doc.data()
      versions.push({
        id: doc.id,
        versionName: data.versionName,
        description: data.description,
        format: data.format,
        metadata: data.metadata,
        stats: data.stats,
        // Don't include full content in list view for performance
        hasContent: !!data.content
      })
    })

    res.json({
      success: true,
      docId,
      versions,
      total: versions.length
    })

  } catch (error) {
    console.error(`❌ Error fetching versions for document ${docId}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch versions',
      details: error.message
    })
  }
})

/**
 * Get Specific Version API Endpoint
 * GET /api/screenplays/:docId/versions/:versionId
 */
app.get('/api/screenplays/:docId/versions/:versionId', async (req, res) => {
  const { docId, versionId } = req.params

  try {
    const versionRef = db.collection('screenplays').doc(docId).collection('versions').doc(versionId)
    const versionDoc = await versionRef.get()

    if (!versionDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      })
    }

    const versionData = versionDoc.data()
    res.json({
      success: true,
      version: {
        id: versionDoc.id,
        ...versionData
      }
    })

  } catch (error) {
    console.error(`❌ Error fetching version ${versionId}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version',
      details: error.message
    })
  }
})

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      firestore: 'connected',
      rtdb: 'connected'
    }
  })
})

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`)
  console.log(`📡 Save Version API available at: http://localhost:${PORT}/api/screenplays/:docId/save-version`)
  console.log(`🔍 Health check: http://localhost:${PORT}/health`)
})

export default app
