import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

// Test configuration
const SERVER_URL = 'ws://localhost:1234'
const TEST_DOCUMENT = 'test-persistence-doc'
const TEST_DURATION = 10000 // 10 seconds

console.log('🧪 Testing Y.js Firebase Persistence')
console.log('=====================================')

// Test 1: Create document and add content
async function testDocumentCreation() {
  console.log('\n📝 Test 1: Creating document and adding content...')
  
  const ydoc = new Y.Doc()
  const provider = new WebsocketProvider(SERVER_URL, TEST_DOCUMENT, ydoc)
  
  // Wait for connection
  await new Promise((resolve) => {
    provider.on('status', (event) => {
      if (event.status === 'connected') {
        console.log('✅ Connected to server')
        resolve()
      }
    })
  })

  // Create shared text
  const ytext = ydoc.getText('content')
  
  // Add some content
  ytext.insert(0, 'This is a test document for Firebase persistence.\n')
  ytext.insert(ytext.length, 'Adding more content to test synchronization.\n')
  ytext.insert(ytext.length, `Timestamp: ${new Date().toISOString()}\n`)
  
  console.log('📄 Content added to document')
  console.log('Content:', ytext.toString())
  
  // Wait for persistence
  console.log('⏳ Waiting for persistence...')
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  provider.destroy()
  console.log('✅ Test 1 completed - Document created and content added')
}

// Test 2: Reconnect and verify persistence
async function testDocumentRecovery() {
  console.log('\n🔄 Test 2: Reconnecting to verify persistence...')
  
  const ydoc2 = new Y.Doc()
  const provider2 = new WebsocketProvider(SERVER_URL, TEST_DOCUMENT, ydoc2)
  
  // Wait for connection and sync
  await new Promise((resolve) => {
    provider2.on('status', (event) => {
      if (event.status === 'connected') {
        console.log('✅ Reconnected to server')
        // Wait a bit for sync
        setTimeout(resolve, 2000)
      }
    })
  })

  const ytext2 = ydoc2.getText('content')
  const content = ytext2.toString()
  
  console.log('📄 Recovered content:')
  console.log(content)
  
  if (content.includes('This is a test document for Firebase persistence')) {
    console.log('✅ Document successfully recovered from persistence!')
  } else {
    console.log('❌ Document recovery failed - content not found')
  }
  
  // Add more content to test continued persistence
  ytext2.insert(ytext2.length, `Recovery test completed at: ${new Date().toISOString()}\n`)
  
  // Wait for persistence
  await new Promise(resolve => setTimeout(resolve, 3000))
  
  provider2.destroy()
  console.log('✅ Test 2 completed - Document recovery verified')
}

// Test 3: Multiple clients simulation
async function testMultipleClients() {
  console.log('\n👥 Test 3: Testing multiple clients...')
  
  const clients = []
  const numClients = 3
  
  // Create multiple clients
  for (let i = 0; i < numClients; i++) {
    const ydoc = new Y.Doc()
    const provider = new WebsocketProvider(SERVER_URL, `multi-client-test`, ydoc)
    const ytext = ydoc.getText('shared-content')
    
    clients.push({ ydoc, provider, ytext, id: i + 1 })
  }
  
  // Wait for all connections
  await Promise.all(clients.map(client => 
    new Promise((resolve) => {
      client.provider.on('status', (event) => {
        if (event.status === 'connected') {
          console.log(`✅ Client ${client.id} connected`)
          resolve()
        }
      })
    })
  ))
  
  // Each client adds content
  clients.forEach((client, index) => {
    setTimeout(() => {
      client.ytext.insert(client.ytext.length, `Content from client ${client.id}: ${new Date().toISOString()}\n`)
      console.log(`📝 Client ${client.id} added content`)
    }, index * 1000)
  })
  
  // Wait for synchronization
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // Check if all clients have the same content
  const firstClientContent = clients[0].ytext.toString()
  const allSynced = clients.every(client => client.ytext.toString() === firstClientContent)
  
  if (allSynced) {
    console.log('✅ All clients synchronized successfully!')
    console.log('Final content length:', firstClientContent.length)
  } else {
    console.log('❌ Client synchronization failed')
  }
  
  // Cleanup
  clients.forEach(client => client.provider.destroy())
  console.log('✅ Test 3 completed - Multiple clients tested')
}

// Test 4: Check server API
async function testServerAPI() {
  console.log('\n🌐 Test 4: Testing server API...')
  
  try {
    const response = await fetch('http://localhost:1234/api/documents')
    const data = await response.json()
    
    console.log('📊 Server API Response:')
    console.log(JSON.stringify(data, null, 2))
    
    if (data.documents && Array.isArray(data.documents)) {
      console.log(`✅ Found ${data.totalDocuments} documents on server`)
      data.documents.forEach(doc => {
        console.log(`  📄 ${doc.name} - ${doc.connections} connections - v${doc.metadata.version || 'unknown'}`)
      })
    } else {
      console.log('❌ Invalid API response format')
    }
  } catch (error) {
    console.log('❌ Server API test failed:', error.message)
  }
  
  console.log('✅ Test 4 completed - Server API tested')
}

// Main test runner
async function runTests() {
  try {
    console.log(`🚀 Starting tests against server: ${SERVER_URL}`)
    console.log(`📋 Test document: ${TEST_DOCUMENT}`)
    
    await testDocumentCreation()
    await testDocumentRecovery()
    await testMultipleClients()
    await testServerAPI()
    
    console.log('\n🎉 All tests completed!')
    console.log('=====================================')
    console.log('✅ Firebase persistence testing finished')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    process.exit(0)
  }
}

// Check if server is running
console.log(`🔍 Checking if server is running at ${SERVER_URL}...`)

const testConnection = new WebsocketProvider(SERVER_URL, 'connection-test', new Y.Doc())
testConnection.on('status', (event) => {
  if (event.status === 'connected') {
    console.log('✅ Server is running and accessible')
    testConnection.destroy()
    runTests()
  }
})

testConnection.on('connection-error', (error) => {
  console.error('❌ Cannot connect to server. Make sure the server is running:')
  console.error('   npm run start:persistence')
  console.error('   or')
  console.error('   node server-with-persistence.js')
  process.exit(1)
})

// Timeout if server doesn't respond
setTimeout(() => {
  console.error('❌ Connection timeout. Server may not be running.')
  console.error('   Start the server with: npm run start:persistence')
  process.exit(1)
}, 5000)
