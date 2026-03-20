# FISHSTAGRAM — Project Handoff & Continuation Guide

**Last updated: March 20, 2026**
**Owner: Oren (OREN@floridasoilandwater.com)**

---

## What Is Fishstagram?

Fishstagram is a fishing-focused social media app — think Instagram but purely for the fishing community. Short-form content, catch photos/videos, species tagging, location sharing (general, not exact spots), and community features like likes, comments, follows, and DMs.

---

## Architecture Overview

### Two Projects

There are TWO separate projects on the user's Windows PC:

1. **Web App (reference):** `C:\Users\opinc\unnamed-project\`
   - React (Create React App) + Supabase
   - This is the fully-built web version with all features working
   - NOT actively being developed anymore — it's the reference codebase

2. **Mobile App (active):** `C:\Users\opinc\fishstagram\`
   - React Native + Expo SDK 53 + Supabase
   - This is what we're actively building — porting the web app to mobile
   - Runs on Android emulator (Pixel 9 via Android Studio)
   - User is on Windows, no Mac, no iOS simulator

### Backend

- **Supabase (hosted):** `https://bqrvowpfanmbjlqeslem.supabase.co`
- Auth, Postgres DB, file storage for media
- The anon key is in `src/lib/supabase.js`
- Same backend is shared between web and mobile — same database, same storage bucket

### Database Tables

- `profiles` — user profiles (username, display_name, avatar_url, bio, home_state)
- `posts` — photo/video posts (user_id, caption, location, species, media_url, media_type, weight, length)
- `likes` — post likes
- `comments` — post comments
- `comment_likes` — likes on comments
- `follows` — follower/following relationships
- `conversations` — DM conversation pairs (user1_id, user2_id)
- `messages` — DM messages (conversation_id, sender_id, content)
- `message_reads` — tracks last read timestamp per user per conversation
- `notifications` — like/comment/follow notifications (user_id, actor_id, type, post_id, read)
- `push_tokens` — ready for push notifications (not wired up yet)

**Notes:**
- There WAS a duplicate `Profiles` (capital P) table that was dropped. Only lowercase `profiles` exists now.
- RLS is enabled on all tables with appropriate policies.

---

## Mobile App File Structure

```
C:\Users\opinc\fishstagram\
├── App.js                          # Main entry — auth check + bottom tab navigator
├── package.json                    # Expo 53, React Native 0.79.6, React 19
├── src/
│   ├── lib/
│   │   ├── supabase.js             # Supabase client with AsyncStorage for auth persistence
│   │   ├── utils.js                # timeAgo() helper
│   │   └── species.js              # Fish species list (condensed version for mobile)
│   ├── screens/
│   │   ├── AuthScreen.js           # Login / Sign Up screen
│   │   ├── FeedScreen.js           # Main feed — paginated, pull to refresh, edit/delete posts
│   │   ├── NewPostScreen.js        # Create post — photo picker, caption, location, species tag
│   │   ├── ReelsScreen.js          # TikTok-style vertical video feed with snap scrolling
│   │   ├── ProfileScreen.js        # User profile — grid/timeline view, edit profile, follow/unfollow, edit/delete posts, logout
│   │   ├── NotificationsScreen.js  # Like/comment/follow notifications
│   │   └── RegsScreen.js           # State fishing regulations guidebook
│   └── components/
│       └── Comments.js             # Expandable comments with likes, batched profile fetching, delete own comments
```

---

## Tab Navigation Order

Feed → Post → Reels → Guide → Notifs → You

There is also a hidden `ProfileView` screen (no tab button) used for viewing other users' profiles via navigation.

---

## Key Dependencies (from package.json)

```json
{
  "@react-native-async-storage/async-storage": "2.1.2",
  "@react-native-picker/picker": "2.11.1",
  "@react-navigation/bottom-tabs": "^7.15.5",
  "@react-navigation/native": "^7.1.33",
  "@supabase/supabase-js": "^2.99.2",
  "expo": "53",
  "expo-av": "~15.1.7",
  "expo-crypto": "~14.1.5",
  "expo-image-picker": "~16.1.4",
  "expo-status-bar": "~2.2.3",
  "expo-video": "~2.2.2",
  "react": "19.0.0",
  "react-native": "0.79.6",
  "react-native-safe-area-context": "5.4.0",
  "react-native-screens": "~4.11.1",
  "react-native-url-polyfill": "^3.0.0"
}
```

---

## What's Been Ported (Working)

- **Auth** — login/signup with Supabase, session persists via AsyncStorage
- **Feed with pagination** — 10 posts at a time, infinite scroll, pull to refresh
- **Photo posts display** — with user avatar, display name, location, species badge, timestamp
- **Video posts display** — using expo-video (VideoView + useVideoPlayer)
- **Likes on posts** — optimistic UI update, creates notification for post owner
- **Comments** — expandable per post, with likes on comments, batched profile fetching, delete own comments
- **New Post** — photo picker, caption, location, species autocomplete from species list, upload to Supabase storage
- **Reels** — vertical snap-scroll video feed (filters posts where media_type='video'), like, comment overlay, avatar link to profile
- **Profile** — own profile: edit display name/bio/username, avatar upload, logout. Other profiles: follow/unfollow, grid/timeline view
- **Edit/Delete Posts** — three-dot menu ("•••") on own posts in both FeedScreen and ProfileScreen timeline view. Edit opens a bottom-sheet modal for caption/location/species. Delete shows Alert confirmation.
- **Notifications** — like/comment/follow, marks as read on tab open, unread badge on tab icon, polls every 15 seconds
- **Guidebook/Regs** — state picker with all 50 states, fishing agency links, favorite state saved to profile
- **Bottom tab navigation** — text only labels (no icons), centered, dark theme
- **Dark theme throughout** — #0a0a0a background

---

## What's NOT Ported Yet

- **Messages/DMs** — web has full DM system with conversations list, chat view, unread counts. DB tables (conversations, messages, message_reads) exist and are ready.
- **Search** — web has user/species/location search
- **Share Post** — web lets you share posts via DMs
- **Reels extras** — share button, mute/unmute toggle
- **PostViewer overlay** — web has a modal for viewing individual posts from notification taps
- **Push notifications** — push_tokens table exists but not wired to Expo push

---

## Screen-by-Screen Detail

### App.js (Entry Point)
- Checks Supabase auth session on mount
- Shows "FISHSTAGRAM" splash text while loading
- If no session → renders AuthScreen
- If session → renders NavigationContainer with bottom tabs
- Polls unread notification count every 15 seconds for tab badge
- Dark theme applied globally via NavigationContainer theme

### AuthScreen.js
- Toggle between Login and Sign Up modes
- Uses supabase.auth.signInWithPassword and supabase.auth.signUp
- Handles duplicate email detection (identities.length === 0)
- Shows confirmation link message on signup
- KeyboardAvoidingView for iOS/Android keyboard handling

### FeedScreen.js
- Paginated feed: PAGE_SIZE = 10, loads more on scroll via onEndReached
- attachProfiles(): batch-fetches profiles for all post authors in one query
- fetchLikesForPosts(): only fetches likes for currently loaded post IDs
- VideoPost component: uses useVideoPlayer + VideoView from expo-video
- Like handler: optimistic UI, creates notification for post owner
- **Edit/Delete**: Three-dot menu button on own posts. Menu has Edit Post, Delete Post, Cancel. Edit opens Modal with caption/location/species fields (species has autocomplete from SPECIES list). Delete shows Alert.alert confirmation.
- Pull to refresh clears likes state and reloads

### NewPostScreen.js
- ImagePicker.launchImageLibraryAsync for photo selection
- Species autocomplete: filters SPECIES array, shows top 6 matches
- Upload flow: fetch URI → blob → arrayBuffer → supabase.storage.upload
- Navigates to Feed tab on successful post

### ReelsScreen.js
- Fetches only video posts (media_type='video')
- FlatList with pagingEnabled, snapToInterval = screen height - 170
- ReelItem component: useVideoPlayer with loop=true, plays/pauses based on isActive
- Right side actions: avatar (links to profile), like, comment toggle
- Bottom info: username, location, caption, species badge
- Comments overlay: slides up from bottom, 50% max height

### ProfileScreen.js
- Handles both own profile (session.user.id) and other users (route.params.userId)
- Own profile: edit form for display name, bio, username, avatar upload
- Avatar upload: same blob→arrayBuffer→supabase.storage pattern with upsert:true
- Other profiles: follow/unfollow button, creates follow notification
- Grid view: thumbnail grid (width/3 squares), tap switches to timeline
- Timeline view: full-width images with location, caption, species badge, comments
- **Edit/Delete on timeline**: same three-dot menu pattern as FeedScreen
- Stats: post count, follower count, following count

### NotificationsScreen.js
- Fetches last 50 notifications for current user
- Batch-fetches actor profiles
- Marks all as read on mount
- Displays like/comment/follow with appropriate icons
- Tapping follow notification navigates to that user's profile

### RegsScreen.js
- Hardcoded REGS object with all 50 US states
- Each state has: agency name, official website link
- Picker dropdown to select state
- Favorite state: saves to profiles.home_state, shows starred at top of picker
- "Visit Website" button opens Linking.openURL

### Comments.js (Component)
- Expandable: "View comments" / "Hide comments" toggle
- Lazy loads: only fetches when opened
- Batch-fetches profiles for all comment authors
- Batch-fetches comment_likes for all comments
- Comment likes with optimistic UI
- Delete own comments (X button, no confirmation)
- Add comment input with "Post" button
- Creates notification for post owner on new comment

---

## Supabase Client Config (src/lib/supabase.js)

```javascript
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bqrvowpfanmbjlqeslem.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcnZvd3BmYW5tYmpscWVzbGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzg5NDUsImV4cCI6MjA4ODc1NDk0NX0.Mz3ajwfAbsy3sS4Kk5c419pz9a6GJRBdPqFCZJ3DUhI'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

---

## Utility: timeAgo (src/lib/utils.js)

Returns human-readable relative timestamps: "Just now", "1 minute ago", "5 minutes ago", "1 hour ago", "Yesterday", "X days ago". Uses bucket rounding (not exact minutes).

---

## Species List (src/lib/species.js)

Exports a `SPECIES` array of ~130 common North American freshwater and saltwater fish species as strings. Used for autocomplete in NewPostScreen and the edit post modal. Examples: 'Largemouth Bass', 'Red Drum', 'Mahi Mahi', 'Bluefin Tuna', etc.

---

## Performance Optimizations Already Done

- Feed paginates with PAGE_SIZE = 10 (not loading entire post table)
- Likes only fetched for currently loaded post IDs (not entire likes table)
- Comments batch-fetch profiles in one query instead of N+1
- Reels use expo-video (not deprecated expo-av)
- Profile screen batch-fetches follower/following counts

---

## Known Issues / Notes

- expo-av deprecation warning may still appear if any code references it (should be fully replaced by expo-video now)
- VirtualizedList performance warning appears sometimes — not a bug, just the emulator being slow
- Android emulator required BIOS virtualization to be enabled (Intel VT-x)
- Expo Go does NOT work with SDK 53 — must use dev builds or the Android emulator
- User does not have a Mac — iOS testing is not possible right now. Plan is to use EAS Build for iOS when ready for App Store.
- The web app's Regs.js has a massive species-by-state database with scientific names and wiki links. The mobile RegsScreen.js is simplified (just state agency + link). Could be expanded later.
- **Emulator has no photos/videos by default.** To test posting, either save images from Chrome inside the emulator, or push files via ADB:
  ```
  C:\Users\opinc\AppData\Local\Android\Sdk\platform-tools\adb push C:\path\to\image.jpg /sdcard/DCIM/
  C:\Users\opinc\AppData\Local\Android\Sdk\platform-tools\adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/DCIM/image.jpg
  ```

---

## Development Environment

- **OS:** Windows 11
- **Editor:** VS Code
- **Terminal:** Windows Command Prompt (not PowerShell, not WSL)
- **Android Emulator:** Android Studio → Pixel 9, requires BIOS virtualization enabled
- **Running the app:** `cd C:\Users\opinc\fishstagram && npx expo start --clear`, press `a` for Android
- **ADB path:** `C:\Users\opinc\AppData\Local\Android\Sdk\platform-tools\adb`
- **If emulator shows "device offline":** kill ADB server (`adb kill-server`), close emulator, relaunch from Android Studio

---

## User Context

- The user (Oren) is learning to code — has some HTML/CSS knowledge, not a developer
- He has a partner handling social/distribution
- He's serious about this — it's not a pet project, he wants to release it on the App Store
- He gets frustrated when things are slow or don't work — be direct, give exact instructions, don't make him guess
- When giving file edits, be specific about what to find and replace
- When giving terminal commands, use Windows syntax (not Unix)
- He prefers you ask for permission before major actions and limit unnecessary token usage

---

## Web App Reference Files (C:\Users\opinc\unnamed-project\src\)

These are the web versions of each feature. Use them as reference when porting:

- `Feed.js` — Feed with edit/delete modals, species autocomplete, pagination
- `Profile.js` — Profile with grid/timeline, edit, follow/unfollow
- `Messages.js` — Full DM system (conversations list, chat view, unread counts)
- `Search.js` — User/species/location search
- `Comments.js` — Comments with likes, batched profiles
- `NewPost.js` — Post creation with media upload
- `Reels.js` — Video feed
- `Notifications.js` — Notification list
- `Regs.js` — Detailed species-by-state regulations
- `PostViewer.js` — Modal for viewing individual posts
- `SharePost.js` — Share posts via DMs
- `LikeButton.js` — Reusable like component
- `supabase.js` — Supabase client (web version, no AsyncStorage)
- `species.js` — Full species list (larger than mobile version)

---

## Suggested Next Steps (in priority order)

1. **Messages/DMs** — Port the messaging system (conversations list, chat view, unread badges). DB tables already exist.
2. **Search** — Port user/species/location search
3. **Push notifications** — Wire up Expo push notifications with the existing push_tokens table
4. **Polish UI** — The app works but could use refinement (spacing, animations, loading states)
5. **EAS Build setup** — When ready to test on real devices and submit to App Store

---

## FULL SOURCE CODE — Every File

Below is the complete source code for every file in the mobile app. This allows Claude to have full context without needing to read files from disk.

---

### App.js

```javascript
import { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View } from 'react-native'
import { supabase } from './src/lib/supabase'
import AuthScreen from './src/screens/AuthScreen'
import FeedScreen from './src/screens/FeedScreen'
import NewPostScreen from './src/screens/NewPostScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import NotificationsScreen from './src/screens/NotificationsScreen'
import RegsScreen from './src/screens/RegsScreen'
import ReelsScreen from './src/screens/ReelsScreen'

const Tab = createBottomTabNavigator()

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0a0a0a',
    card: '#0a0a0a',
    text: '#fff',
    border: '#1a1a1a',
    primary: '#fff',
  },
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unreadNotifs, setUnreadNotifs] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    const fetchUnreadNotifs = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('read', false)
      setUnreadNotifs(count || 0)
    }
    fetchUnreadNotifs()
    const interval = setInterval(fetchUnreadNotifs, 15000)
    return () => clearInterval(interval)
  }, [session])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>FISHSTAGRAM</Text>
      </View>
    )
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <AuthScreen />
      </>
    )
  }

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer theme={DarkTheme}>
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
            headerTitleStyle: { color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: -0.5 },
            tabBarStyle: { backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
            tabBarActiveTintColor: '#fff',
            tabBarInactiveTintColor: '#555',
            tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
            tabBarItemStyle: { flex: 1 },
          }}
        >
          <Tab.Screen name="Feed" options={{ headerTitle: 'FISHSTAGRAM', tabBarLabel: 'FEED', tabBarIcon: () => null }}>
            {(props) => <FeedScreen {...props} session={session} />}
          </Tab.Screen>
          <Tab.Screen name="Post" options={{ headerTitle: 'New Post', tabBarLabel: 'POST', tabBarIcon: () => null }}>
            {(props) => <NewPostScreen {...props} session={session} />}
          </Tab.Screen>
          <Tab.Screen name="Reels" options={{ headerTitle: 'Reels', tabBarLabel: 'REELS', tabBarIcon: () => null }}>
            {(props) => <ReelsScreen {...props} session={session} />}
          </Tab.Screen>
          <Tab.Screen name="Guide" options={{ headerTitle: 'Guidebook', tabBarLabel: 'GUIDE', tabBarIcon: () => null }}>
            {(props) => <RegsScreen {...props} session={session} />}
          </Tab.Screen>
          <Tab.Screen name="Notifications" options={{ headerTitle: 'Notifications', tabBarLabel: 'NOTIFS', tabBarIcon: () => null, tabBarBadge: unreadNotifs > 0 ? unreadNotifs : undefined }} listeners={{ tabPress: () => setUnreadNotifs(0) }}>
            {(props) => <NotificationsScreen {...props} session={session} />}
          </Tab.Screen>
          <Tab.Screen name="Profile" options={{ headerTitle: 'Profile', tabBarLabel: 'YOU', tabBarIcon: () => null }}>
            {(props) => <ProfileScreen {...props} session={session} />}
          </Tab.Screen>
          <Tab.Screen name="ProfileView" options={{ headerTitle: 'Profile', tabBarButton: () => null, tabBarStyle: { display: 'none' }, tabBarItemStyle: { display: 'none' } }}>
            {(props) => <ProfileScreen {...props} session={session} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </>
  )
}
```

### src/lib/supabase.js

```javascript
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bqrvowpfanmbjlqeslem.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcnZvd3BmYW5tYmpscWVzbGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzg5NDUsImV4cCI6MjA4ODc1NDk0NX0.Mz3ajwfAbsy3sS4Kk5c419pz9a6GJRBdPqFCZJ3DUhI'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

### src/lib/utils.js

```javascript
export function timeAgo(timestamp) {
  const now = new Date()
  const posted = new Date(timestamp)
  const seconds = Math.floor((now - posted) / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes === 1) return '1 minute ago'
  if (minutes < 5) return `${minutes} minutes ago`
  if (minutes < 10) return '5 minutes ago'
  if (minutes < 20) return '10 minutes ago'
  if (minutes < 30) return '20 minutes ago'
  if (minutes < 60) return '30 minutes ago'
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}
```

### src/lib/species.js

(Exports SPECIES array of ~130 fish species strings — too long to include fully. Key entries: 'African Pompano', 'Largemouth Bass', 'Red Drum', 'Mahi Mahi', 'Bluefin Tuna', 'Walleye', 'Yellow Perch', 'Yellowfin Tuna', 'Yellowtail Snapper'. The full list is in the file on disk.)

---

**End of handoff document. Paste this entire document into a new Claude conversation to continue development.**
