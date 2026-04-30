import { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, TouchableOpacity } from 'react-native'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { Oswald_500Medium, Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase } from './src/lib/supabase'
import { fonts } from './src/lib/typography'
import AuthScreen from './src/screens/AuthScreen'
import FeedScreen from './src/screens/FeedScreen'
import NewPostScreen from './src/screens/NewPostScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import NotificationsScreen from './src/screens/NotificationsScreen'
import RegsScreen from './src/screens/RegsScreen'
import StateRegsScreen from './src/screens/StateRegsScreen'
import ReelsScreen from './src/screens/ReelsScreen'
import SearchScreen from './src/screens/SearchScreen'
import CreateTournamentScreen from './src/screens/CreateTournamentScreen'
import TournamentDetailScreen from './src/screens/TournamentDetailScreen'
import TournamentsScreen from './src/screens/TournamentsScreen'
import { BellIcon, TrophyIcon, BackIcon, SearchIcon } from './src/components/Icons'

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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
  })

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
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .eq('read', false)
        setUnreadNotifs(count || 0)
      } catch (e) {}
    }
    fetchUnreadNotifs()

    // Realtime listener for new notifications
    const channel = supabase
      .channel('notif-count')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${session.user.id}`,
      }, () => {
        setUnreadNotifs(prev => prev + 1)
      })
      .subscribe()

    // Light fallback poll in case realtime disconnects
    const interval = setInterval(fetchUnreadNotifs, 60000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [session])

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 24, fontFamily: fonts.condensedBold, letterSpacing: 0.5 }}>LuckyFin</Text>
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

  const HeaderActions = ({ navigation, showTournament = true, showSearch = false }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
      {showSearch ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('Search')}
          style={{ marginRight: 14 }}
        >
          <SearchIcon size={22} color="#fff" />
        </TouchableOpacity>
      ) : null}
      {showTournament ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('Tournaments')}
          style={{ marginRight: 14 }}
        >
          <TrophyIcon size={22} color="#d4a733" />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        onPress={() => {
          setUnreadNotifs(0)
          navigation.navigate('Notifications')
        }}
        style={{ position: 'relative' }}
      >
        <BellIcon size={22} color="#fff" />
        {unreadNotifs > 0 && (
          <View style={{
            position: 'absolute', top: -6, right: -8,
            backgroundColor: '#ff3b5c', borderRadius: 9,
            minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 4,
          }}>
            <Text style={{ color: '#fff', fontSize: 10, fontFamily: fonts.bold }}>
              {unreadNotifs > 99 ? '99+' : unreadNotifs}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <NavigationContainer theme={DarkTheme}>
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
            headerTitleStyle: { color: '#fff', fontFamily: fonts.condensedSemibold, fontSize: 19, letterSpacing: 0.2 },
            tabBarStyle: { backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
            tabBarActiveTintColor: '#fff',
            tabBarInactiveTintColor: '#555',
            tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.condensed, letterSpacing: 0.9 },
            tabBarItemStyle: { flex: 1 },
          }}
        >
          <Tab.Screen
            name="Feed"
            options={({ navigation }) => ({
              headerTitle: 'LuckyFin',
              tabBarLabel: 'FEED',
              tabBarIcon: () => null,
              headerRight: () => <HeaderActions navigation={navigation} showSearch />,
            })}
          >
            {(props) => <FeedScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Guide"
            options={({ navigation }) => ({
              headerTitle: 'Guidebook',
              tabBarLabel: 'GUIDEBOOK',
              tabBarIcon: () => null,
              headerRight: () => <HeaderActions navigation={navigation} />,
            })}
            listeners={({ navigation }) => ({
              tabPress: async (event) => {
                try {
                  const { data } = await supabase
                    .from('profiles')
                    .select('home_state')
                    .eq('id', session.user.id)
                    .single()

                  if (data?.home_state) {
                    event.preventDefault()
                    navigation.navigate('StateGuide', { stateName: data.home_state })
                  }
                } catch (e) {}
              },
            })}
          >
            {(props) => <RegsScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Reels"
            options={({ navigation }) => ({
              headerTitle: 'Reels',
              tabBarLabel: 'REELS',
              tabBarIcon: () => null,
              headerRight: () => <HeaderActions navigation={navigation} showSearch />,
            })}
          >
            {(props) => <ReelsScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Post"
            options={({ navigation }) => ({
              headerTitle: 'New Post',
              tabBarLabel: 'POST',
              tabBarIcon: () => null,
              headerRight: () => <HeaderActions navigation={navigation} />,
            })}
          >
            {(props) => <NewPostScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Profile"
            options={({ navigation }) => ({
              headerTitle: 'Profile',
              tabBarLabel: 'ANGLER',
              tabBarIcon: () => null,
              headerRight: () => <HeaderActions navigation={navigation} showSearch />,
            })}
          >
            {(props) => <ProfileScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Tournaments"
            options={({ navigation }) => ({
              headerTitle: 'Tournaments',
              headerTitleStyle: { color: '#d4a733', fontFamily: fonts.condensedSemibold, fontSize: 19, letterSpacing: 0.2 },
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
              headerRight: () => <HeaderActions navigation={navigation} showTournament={false} />,
            })}
          >
            {(props) => <TournamentsScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="CreateTournament"
            options={({ navigation }) => ({
              headerTitle: 'Create Tournament',
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
              headerRight: () => <HeaderActions navigation={navigation} showTournament={false} />,
            })}
          >
            {(props) => <CreateTournamentScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="TournamentDetail"
            options={({ navigation }) => ({
              headerTitle: '',
              headerLeft: () => (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Tournaments')}
                  style={{ marginLeft: 8, paddingVertical: 4, paddingRight: 8, flexDirection: 'row', alignItems: 'center' }}
                >
                  <BackIcon size={22} color="#d4a733" />
                  <Text style={{ color: '#d4a733', fontSize: 18, fontFamily: fonts.condensed, letterSpacing: 0.5, marginLeft: 2 }}>Tournaments</Text>
                </TouchableOpacity>
              ),
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
              headerRight: () => <HeaderActions navigation={navigation} showTournament={false} />,
            })}
          >
            {(props) => <TournamentDetailScreen {...props} session={session} />}
          </Tab.Screen>

          {/* Hidden screens - no tab button */}
          <Tab.Screen
            name="StateGuide"
            options={({ route, navigation }) => ({
              headerTitle: '',
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
              headerLeft: () => (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Guide')}
                  style={{ marginLeft: 8, paddingVertical: 4, paddingRight: 8, flexDirection: 'row', alignItems: 'center' }}
                >
                  <BackIcon size={22} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 18, fontFamily: fonts.condensed, letterSpacing: 0.5, marginLeft: 2 }}>Guidebook</Text>
                </TouchableOpacity>
              ),
            })}
          >
            {(props) => <StateRegsScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Notifications"
            options={{
              headerTitle: 'Notifications',
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
            }}
          >
            {(props) => <NotificationsScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="Search"
            options={{
              headerTitle: 'Search',
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
            }}
          >
            {(props) => <SearchScreen {...props} session={session} />}
          </Tab.Screen>

          <Tab.Screen
            name="ProfileView"
            options={({ navigation }) => ({
              headerTitle: 'Profile',
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
              headerRight: () => <HeaderActions navigation={navigation} showSearch />,
            })}
          >
            {(props) => <ProfileScreen {...props} session={session} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}
