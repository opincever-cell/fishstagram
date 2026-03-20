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
          <Tab.Screen
            name="Feed"
            options={{
              headerTitle: 'FISHSTAGRAM',
              tabBarLabel: 'FEED',
              tabBarIcon: () => null,
            }}
          >
            {(props) => <FeedScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Post"
            options={{
              headerTitle: 'New Post',
              tabBarLabel: 'POST',
              tabBarIcon: () => null,
            }}
          >
            {(props) => <NewPostScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Reels"
            options={{
              headerTitle: 'Reels',
              tabBarLabel: 'REELS',
              tabBarIcon: () => null,
            }}
          >
            {(props) => <ReelsScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Guide"
            options={{
              headerTitle: 'Guidebook',
              tabBarLabel: 'GUIDE',
              tabBarIcon: () => null,
            }}
          >
            {(props) => <RegsScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Notifications"
            options={{
              headerTitle: 'Notifications',
              tabBarLabel: 'NOTIFS',
              tabBarIcon: () => null,
              tabBarBadge: unreadNotifs > 0 ? unreadNotifs : undefined,
            }}
            listeners={{ tabPress: () => setUnreadNotifs(0) }}
          >
            {(props) => <NotificationsScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Profile"
            options={{
              headerTitle: 'Profile',
              tabBarLabel: 'YOU',
              tabBarIcon: () => null,
            }}
          >
            {(props) => <ProfileScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="ProfileView"
            options={{
              headerTitle: 'Profile',
              tabBarButton: () => null,
              tabBarStyle: { display: 'none' },
              tabBarItemStyle: { display: 'none' },
            }}
          >
            {(props) => <ProfileScreen {...props} session={session} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </>
  )
}
