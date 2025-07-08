# Firebase Configuration Checklist

## ✅ 1. Firebase Configuration Check

Your `src/lib/firebase.ts` looks **GOOD**! Here's what I found:

### Current Configuration:
- **Project ID**: `liqid-dd431`
- **Auth Domain**: `liqid-dd431.firebaseapp.com`
- **API Key**: Present and configured
- **Firestore**: Properly initialized with optimized settings

### ✅ What's Working:
- Firebase SDK properly initialized
- Firestore configured with unlimited cache
- Long polling enabled for better reliability
- Offline persistence enabled (when not in StackBlitz)

### ⚠️ Potential Issue:
Your config has this line that might affect local development:
```typescript
connectFirestoreEmulator(db, 'localhost', 8080);
```

**To Check**: Make sure you're NOT running the Firestore emulator, or comment out this line for production Firebase testing.

---

## ✅ 2. Firestore Rules Check

Your `firestore.rules` are **EXCELLENT** for collaborative editing! Here's what's configured:

### ✅ Collaborative Editing Rules (PERFECT):
```javascript
// Live collaborative edits - ✅ CONFIGURED
match /projects/{projectId}/screenplays/{screenplayId}/live_edits/{blockId} {
  allow read, write: if isSignedIn();
}

// Cursor positions - ✅ CONFIGURED  
match /cursor_positions/{userId} {
  allow read: if isSignedIn();
  allow write: if isSignedIn() && request.auth.uid == userId;
}
```

### ✅ Additional Collections Supported:
- Comments with thread messages
- Scene locks
- Project access control
- User profiles

**Status**: Your Firestore rules are ready for the Optimistic UI implementation!

---

## 🔍 3. Authentication Setup Check

To verify localhost is authorized in Firebase Auth:

### Step 1: Go to Firebase Console
1. Visit: https://console.firebase.google.com/
2. Select your project: `liqid-dd431`

### Step 2: Check Authentication Settings
1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Verify these domains are listed:
   - `localhost` ✅
   - `liqid-dd431.firebaseapp.com` ✅
   - Any other domains you use

### Step 3: Check Sign-in Methods
1. Go to **Authentication** → **Sign-in method**
2. Verify your enabled sign-in providers (Email/Password, Google, etc.)

---

## 🧪 How to Test Your Configuration

### Test 1: Basic Firebase Connection
1. Open browser console on `http://localhost:5175/`
2. Look for Firebase initialization messages
3. Should see no Firebase connection errors

### Test 2: Authentication Test
1. Try to sign in to your app
2. Check browser console for auth errors
3. Verify user object appears in console

### Test 3: Firestore Connection Test
1. Open browser console
2. Run this test:
```javascript
// Test Firestore connection
import { db } from './src/lib/firebase.ts';
import { collection, getDocs } from 'firebase/firestore';

// This should work without errors
getDocs(collection(db, 'projects')).then(snapshot => {
  console.log('Firestore connected! Projects:', snapshot.size);
}).catch(error => {
  console.error('Firestore error:', error);
});
```

### Test 4: Collaborative Collections Test
1. After signing in, test these collections:
```javascript
// Test live_edits collection
getDocs(collection(db, 'projects/YOUR_PROJECT_ID/screenplays/YOUR_SCREENPLAY_ID/live_edits'))

// Test cursor_positions collection  
getDocs(collection(db, 'projects/YOUR_PROJECT_ID/screenplays/YOUR_SCREENPLAY_ID/cursor_positions'))
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Permission denied" errors
**Solution**: 
- Make sure you're signed in
- Check Firestore rules are deployed
- Verify project ID matches in code

### Issue 2: "Failed to get document" errors
**Solution**:
- Check internet connection
- Verify Firebase project is active
- Check browser console for detailed errors

### Issue 3: Emulator connection errors
**Solution**:
- Comment out emulator connection in `firebase.ts`:
```typescript
// Comment this out for production testing:
// connectFirestoreEmulator(db, 'localhost', 8080);
```

### Issue 4: CORS errors on localhost
**Solution**:
- Add `localhost:5175` to Firebase Auth authorized domains
- Clear browser cache and cookies

---

## 🎯 Quick Verification Commands

### Check if Firebase is working:
```bash
# In your project directory
npm run dev
# Then open http://localhost:5175/ and check browser console
```

### Deploy Firestore rules (if needed):
```bash
firebase deploy --only firestore:rules
```

### Check Firebase project status:
```bash
firebase projects:list
firebase use liqid-dd431
```

---

## ✅ Configuration Status Summary

Based on your files:

| Component | Status | Notes |
|-----------|--------|-------|
| Firebase Config | ✅ **GOOD** | Properly configured for production |
| Firestore Rules | ✅ **EXCELLENT** | All collaborative collections allowed |
| Auth Setup | 🔍 **VERIFY** | Check Firebase Console for localhost |
| Emulator Settings | ⚠️ **CHECK** | May need to disable for production testing |

## 🚀 Ready for Optimistic UI Testing

Your Firebase configuration is ready for the Optimistic UI implementation! The collaborative editing collections (`live_edits`, `cursor_positions`) are properly configured in your Firestore rules.

**Next Steps**:
1. Verify localhost is in Firebase Auth authorized domains
2. Test basic Firebase connection at `http://localhost:5175/`
3. Follow the integration guide to implement Optimistic UI
4. Test collaborative editing with multiple browser tabs

Your setup looks solid for local development testing!
