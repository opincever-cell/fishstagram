import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator
} from 'react-native'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/utils'

export default function NotificationsScreen({ session, navigation }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        const actorIds = [...new Set(data.map(n => n.actor_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', actorIds)
        const profileMap = {}
        profiles?.forEach(p => profileMap[p.id] = p)
        setNotifs(data.map(n => ({ ...n, actor: profileMap[n.actor_id] })))

        // Mark all as read
        await supabase.from('notifications').update({ read: true })
          .eq('user_id', session.user.id).eq('read', false)
      }
      setLoading(false)
    }
    fetchNotifs()
  }, [session])

  const getMessage = (n) => {
    const name = n.actor?.display_name || `@${n.actor?.username || 'Someone'}`
    switch (n.type) {
      case 'like': return `${name} liked your post`
      case 'comment': return `${name} commented on your post`
      case 'follow': return `${name} started following you`
      default: return `${name} interacted with you`
    }
  }

  const renderItem = ({ item: n }) => (
    <TouchableOpacity
      style={[styles.notif, !n.read && styles.unread]}
      onPress={() => {
        if (n.type === 'follow') navigation.navigate('ProfileView', { userId: n.actor_id })
      }}
    >
      <View style={styles.avatar}>
        {n.actor?.avatar_url ? (
          <Image source={{ uri: n.actor.avatar_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarFallback}>🐟</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.notifText}>{getMessage(n)}</Text>
        <Text style={styles.notifTime}>{timeAgo(n.created_at)}</Text>
      </View>
      <Text style={styles.icon}>
        {n.type === 'like' ? '♥' : n.type === 'comment' ? '💬' : n.type === 'follow' ? '👤' : '🔔'}
      </Text>
    </TouchableOpacity>
  )

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#555" size="large" /></View>
  }

  return (
    <FlatList
      data={notifs}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={{ paddingBottom: 100 }}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 60, backgroundColor: '#0a0a0a' },
  emptyText: { color: '#555', fontSize: 16 },
  notif: {
    flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  unread: { backgroundColor: '#0f1a1a' },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#222',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { fontSize: 18 },
  notifText: { color: '#aaa', fontSize: 14 },
  notifTime: { color: '#444', fontSize: 11, marginTop: 2 },
  icon: { fontSize: 18, marginLeft: 8 },
})
