import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, ActivityIndicator, Image
} from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { supabase } from '../lib/supabase'
import Comments from '../components/Comments'

const { width, height } = Dimensions.get('window')
const REEL_HEIGHT = height - 170

function ReelItem({ post, isActive, session, likes, likedPosts, onLike, onViewProfile }) {
  const [showComments, setShowComments] = useState(false)
  const profile = post.profiles
  const liked = likedPosts[post.id]
  const likeCount = likes[post.id] || 0

  const player = useVideoPlayer(post.media_url, player => {
    player.loop = true
  })

  useEffect(() => {
    if (isActive) {
      player.play()
    } else {
      player.pause()
      setShowComments(false)
    }
  }, [isActive])

  return (
    <View style={styles.reel}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Right side actions */}
      <View style={styles.actions}>
        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => onViewProfile?.(post.user_id)}
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={{ fontSize: 16 }}>🐟</Text>
          )}
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity style={styles.actionBtn} onPress={() => onLike(post.id)}>
          <Text style={{ fontSize: 28, color: liked ? '#ff3b5c' : 'rgba(255,255,255,0.7)' }}>♥</Text>
          {likeCount > 0 && <Text style={styles.actionCount}>{likeCount}</Text>}
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(prev => !prev)}>
          <Text style={{ fontSize: 24, color: '#fff' }}>💬</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        <TouchableOpacity onPress={() => onViewProfile?.(post.user_id)}>
          <Text style={styles.reelUsername}>
            {profile?.display_name || `@${profile?.username || 'unknown'}`}
          </Text>
        </TouchableOpacity>
        {post.location ? <Text style={styles.reelLocation}>📍 {post.location}</Text> : null}
        {post.caption ? <Text style={styles.reelCaption}>{post.caption}</Text> : null}
        {post.species ? (
          <View style={styles.speciesBadge}>
            <Text style={styles.speciesText}>{post.species}</Text>
          </View>
        ) : null}
      </View>

      {/* Comments overlay */}
      {showComments && (
        <View style={styles.commentsOverlay}>
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <TouchableOpacity onPress={() => setShowComments(false)}>
              <Text style={styles.commentsClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <Comments postId={post.id} session={session} />
        </View>
      )}
    </View>
  )
}

export default function ReelsScreen({ session, navigation }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [likes, setLikes] = useState({})
  const [likedPosts, setLikedPosts] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const getPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('media_type', 'video')
        .order('created_at', { ascending: false })

      if (!error && data) {
        const userIds = [...new Set(data.map(p => p.user_id))]
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds)
        const profileMap = {}
        profilesData?.forEach(p => profileMap[p.id] = p)
        setPosts(data.map(post => ({ ...post, profiles: profileMap[post.user_id] || null })))
      }

      const { data: likesData } = await supabase.from('likes').select('post_id, user_id')
      if (likesData) {
        const likeCounts = {}
        const userLikes = {}
        likesData.forEach(like => {
          likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1
          if (like.user_id === session?.user?.id) userLikes[like.post_id] = true
        })
        setLikes(likeCounts)
        setLikedPosts(userLikes)
      }
      setLoading(false)
    }
    getPosts()
  }, [session])

  const handleLike = async (postId) => {
    if (!session) return
    const alreadyLiked = likedPosts[postId]
    setLikedPosts(prev => ({ ...prev, [postId]: !alreadyLiked }))
    setLikes(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (alreadyLiked ? -1 : 1) }))
    if (alreadyLiked) {
      await supabase.from('likes').delete().eq('user_id', session.user.id).eq('post_id', postId)
    } else {
      await supabase.from('likes').insert({ user_id: session.user.id, post_id: postId })
      const post = posts.find(p => p.id === postId)
      if (post && post.user_id !== session.user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, actor_id: session.user.id, type: 'like', post_id: postId,
        })
      }
    }
  }

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index)
    }
  }, [])

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#555" size="large" /></View>
  }

  if (posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No reels yet. Be the first!</Text>
        <TouchableOpacity style={styles.postReelBtn} onPress={() => navigation.navigate('Post')}>
          <Text style={styles.postReelBtnText}>Post a Reel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <ReelItem
            post={item}
            isActive={index === currentIndex}
            session={session}
            likes={likes}
            likedPosts={likedPosts}
            onLike={handleLike}
            onViewProfile={(id) => navigation.navigate('ProfileView', { userId: id })}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={REEL_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => ({
          length: REEL_HEIGHT,
          offset: REEL_HEIGHT * index,
          index,
        })}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 40 },
  emptyText: { color: '#555', fontSize: 16, marginBottom: 24 },
  postReelBtn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  postReelBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  reel: { width: width, height: REEL_HEIGHT, backgroundColor: '#000', position: 'relative' },
  video: { width: '100%', height: '100%' },
  actions: {
    position: 'absolute', right: 12, bottom: 120,
    alignItems: 'center', gap: 20,
  },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#fff',
    backgroundColor: '#222', overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  actionBtn: { alignItems: 'center', gap: 2 },
  actionCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bottomInfo: { position: 'absolute', bottom: 20, left: 12, right: 80 },
  reelUsername: { color: '#fff', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  reelLocation: { color: '#ddd', fontSize: 13, marginBottom: 4 },
  reelCaption: { color: '#ddd', fontSize: 13 },
  speciesBadge: { backgroundColor: '#0891b2', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6, alignSelf: 'flex-start' },
  speciesText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  commentsOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.9)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, maxHeight: '50%',
  },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  commentsTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  commentsClose: { color: '#fff', fontSize: 18 },
})