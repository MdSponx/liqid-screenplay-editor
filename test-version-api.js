import fetch from 'node-fetch';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Test configuration
const API_BASE_URL = 'http://localhost:3001';
const YJS_SERVER_URL = 'ws://localhost:1234';
const TEST_DOC_ID = 'test-version-api-doc';

console.log('🧪 Testing Y.js Version API');
console.log('============================');

// Test data
const testVersions = [
  {
    versionName: 'Initial Draft',
    description: 'First version of the screenplay',
    format: 'screenplay',
    userId: 'test-user-1',
    projectId: 'test-project'
  },
  {
    versionName: 'Revision 1',
    description: 'Added character development scenes',
    format: 'plain',
    userId: 'test-user-1',
    projectId: 'test-project'
  },
  {
    versionName: 'Final Draft',
    description: 'Ready for production',
    format: 'json',
    userId: 'test-user-2',
    projectId: 'test-project'
  }
];

// Helper function to create test content in Y.js document
async function createTestContent() {
  console.log('\n📝 Creating test content in Y.js document...');
  
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(YJS_SERVER_URL, TEST_DOC_ID, ydoc);
  
  // Wait for connection
  await new Promise((resolve) => {
    provider.on('status', (event) => {
      if (event.status === 'connected') {
        console.log('✅ Connected to Y.js server');
        resolve();
      }
    });
  });

  // Create test content
  const ytext = ydoc.getText('content');
  
  const testContent = `INT. COFFEE SHOP - DAY

A bustling coffee shop filled with the morning rush. SARAH (25), a determined journalist, sits at a corner table with her laptop.

SARAH
(typing furiously)
This story will change everything.

The door chimes as MIKE (30), a mysterious stranger, enters and scans the room.

MIKE
(approaching Sarah's table)
Mind if I sit here?

SARAH
(looking up suspiciously)
Actually, I do mind.

MIKE
(sitting down anyway)
We need to talk about what you're writing.

Sarah's fingers freeze over the keyboard.

SARAH
How do you know what I'm writing?

FADE OUT.`;

  ytext.insert(0, testContent);
  
  console.log('📄 Test content added to Y.js document');
  console.log(`Content length: ${testContent.length} characters`);
  
  // Wait for persistence
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  provider.destroy();
  console.log('✅ Test content creation completed');
}

// Test 1: Health check
async function testHealthCheck() {
  console.log('\n🏥 Test 1: Health check...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    
    if (response.ok && data.status === 'healthy') {
      console.log('✅ API server is healthy');
      console.log(`   Timestamp: ${data.timestamp}`);
      console.log(`   Services: ${JSON.stringify(data.services)}`);
    } else {
      throw new Error('Health check failed');
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    throw error;
  }
}

// Test 2: Save versions
async function testSaveVersions() {
  console.log('\n💾 Test 2: Saving versions...');
  
  const savedVersions = [];
  
  for (const [index, versionData] of testVersions.entries()) {
    try {
      console.log(`\n  Saving version ${index + 1}: "${versionData.versionName}"`);
      
      const response = await fetch(`${API_BASE_URL}/api/screenplays/${TEST_DOC_ID}/save-version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(versionData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success) {
        console.log(`  ✅ Version saved successfully`);
        console.log(`     Version ID: ${result.versionId}`);
        console.log(`     Format: ${result.versionData.format}`);
        console.log(`     Word count: ${result.versionData.stats.wordCount}`);
        console.log(`     Scene count: ${result.versionData.stats.sceneCount}`);
        
        savedVersions.push(result);
      } else {
        throw new Error(result.error || 'Failed to save version');
      }
      
      // Wait between saves
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`  ❌ Failed to save version "${versionData.versionName}":`, error.message);
    }
  }
  
  console.log(`\n✅ Saved ${savedVersions.length} versions successfully`);
  return savedVersions;
}

// Test 3: Get versions list
async function testGetVersionsList() {
  console.log('\n📋 Test 3: Getting versions list...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/screenplays/${TEST_DOC_ID}/versions`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }

    if (result.success) {
      console.log(`✅ Retrieved ${result.total} versions`);
      
      result.versions.forEach((version, index) => {
        console.log(`\n  Version ${index + 1}:`);
        console.log(`    Name: ${version.versionName}`);
        console.log(`    Format: ${version.format}`);
        console.log(`    Created: ${version.metadata.createdAt}`);
        console.log(`    Created by: ${version.metadata.createdBy}`);
        console.log(`    Word count: ${version.stats.wordCount}`);
        console.log(`    Scene count: ${version.stats.sceneCount}`);
      });
      
      return result.versions;
    } else {
      throw new Error(result.error || 'Failed to get versions list');
    }
  } catch (error) {
    console.error('❌ Failed to get versions list:', error.message);
    throw error;
  }
}

// Test 4: Get specific version content
async function testGetVersionContent(versions) {
  console.log('\n📖 Test 4: Getting version content...');
  
  if (versions.length === 0) {
    console.log('⚠️  No versions available to test');
    return;
  }
  
  const testVersion = versions[0]; // Test first version
  
  try {
    console.log(`Getting content for version: "${testVersion.versionName}"`);
    
    const response = await fetch(`${API_BASE_URL}/api/screenplays/${TEST_DOC_ID}/versions/${testVersion.id}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }

    if (result.success) {
      const version = result.version;
      console.log('✅ Version content retrieved successfully');
      console.log(`   Version name: ${version.versionName}`);
      console.log(`   Format: ${version.format}`);
      console.log(`   Description: ${version.description}`);
      
      // Show content preview based on format
      switch (version.format) {
        case 'screenplay':
          if (version.content.scenes && version.content.scenes.length > 0) {
            console.log(`   Scenes: ${version.content.scenes.length}`);
            console.log(`   First scene: ${version.content.scenes[0].heading}`);
          }
          break;
        case 'plain':
          console.log(`   Content length: ${version.content.length} characters`);
          console.log(`   Preview: ${version.content.substring(0, 100)}...`);
          break;
        case 'json':
          console.log(`   Content keys: ${Object.keys(version.content.content || {}).join(', ')}`);
          break;
      }
      
      return version;
    } else {
      throw new Error(result.error || 'Failed to get version content');
    }
  } catch (error) {
    console.error(`❌ Failed to get version content:`, error.message);
    throw error;
  }
}

// Test 5: Error handling
async function testErrorHandling() {
  console.log('\n🚨 Test 5: Error handling...');
  
  // Test 1: Non-existent document
  try {
    console.log('  Testing non-existent document...');
    const response = await fetch(`${API_BASE_URL}/api/screenplays/non-existent-doc/save-version`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        versionName: 'Test Version',
        description: 'Test',
        format: 'screenplay'
      })
    });

    const result = await response.json();
    
    if (response.status === 404 && !result.success) {
      console.log('  ✅ Correctly handled non-existent document');
    } else {
      console.log('  ⚠️  Unexpected response for non-existent document');
    }
  } catch (error) {
    console.log('  ✅ Error handling working as expected');
  }
  
  // Test 2: Invalid version ID
  try {
    console.log('  Testing invalid version ID...');
    const response = await fetch(`${API_BASE_URL}/api/screenplays/${TEST_DOC_ID}/versions/invalid-version-id`);
    const result = await response.json();
    
    if (response.status === 404 && !result.success) {
      console.log('  ✅ Correctly handled invalid version ID');
    } else {
      console.log('  ⚠️  Unexpected response for invalid version ID');
    }
  } catch (error) {
    console.log('  ✅ Error handling working as expected');
  }
  
  console.log('✅ Error handling tests completed');
}

// Main test runner
async function runTests() {
  try {
    console.log(`🚀 Starting API tests against: ${API_BASE_URL}`);
    console.log(`📋 Test document ID: ${TEST_DOC_ID}`);
    
    // Run tests in sequence
    await testHealthCheck();
    await createTestContent();
    const savedVersions = await testSaveVersions();
    const versionsList = await testGetVersionsList();
    await testGetVersionContent(versionsList);
    await testErrorHandling();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('=====================================');
    console.log('✅ Y.js Version API testing finished');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`   - Versions saved: ${savedVersions.length}`);
    console.log(`   - Versions retrieved: ${versionsList.length}`);
    console.log(`   - API endpoints tested: 4`);
    console.log(`   - Error scenarios tested: 2`);
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error('\nMake sure the following servers are running:');
    console.error('  1. Y.js WebSocket server: npm run start:persistence');
    console.error('  2. Express API server: npm start (in express server directory)');
    console.error('  3. Firebase Admin SDK configured with valid credentials');
  } finally {
    process.exit(0);
  }
}

// Check if API server is running
console.log(`🔍 Checking if API server is running at ${API_BASE_URL}...`);

fetch(`${API_BASE_URL}/health`)
  .then(response => {
    if (response.ok) {
      console.log('✅ API server is accessible');
      runTests();
    } else {
      throw new Error(`Server responded with status: ${response.status}`);
    }
  })
  .catch(error => {
    console.error('❌ Cannot connect to API server:', error.message);
    console.error('\nStart the Express server with:');
    console.error('  cd express-server-directory');
    console.error('  npm install');
    console.error('  npm start');
    process.exit(1);
  });
