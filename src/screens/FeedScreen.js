import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Dimensions, Modal, TextInput, Alert, ScrollView, Share
} from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/utils'
import { SPECIES } from '../lib/species'
import { normalizePostFraming } from '../lib/postMedia'
import { type } from '../lib/typography'
import Comments from '../components/Comments'
import FramedPostImage from '../components/FramedPostImage'
import { FishIcon, HeartIcon, LocationIcon, CheckIcon, ShareIcon } from '../components/Icons'

const { width } = Dimensions.get('window')
const PAGE_SIZE = 10

function VideoPost({ uri }) {
  const player = useVideoPlayer(uri, player => {
    player.loop = false
  })
  return <VideoView style={styles.postImage} player={player} allowsFullscreen allowsPictureInPicture />
}

export default function FeedScreen({ session, navigation, route }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [likes, setLikes] = useState({})
  const [likedPosts, setLikedPosts] = useState({})
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [menuPost, setMenuPost] = useState(null)
  const [editingPost, setEditingPost] = useState(null)
  const [editCaption, setEditCaption] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editSpecies, setEditSpecies] = useState('')
  const [editSpeciesSearch, setEditSpeciesSearch] = useState('')
  const activeSearchFilter = route?.params?.searchFilter || null
  const searchFilterKey = activeSearchFilter ? `${activeSearchFilter.type}:${activeSearchFilter.value}:${activeSearchFilter.nonce || 'base'}` : 'feed'

  const fetchLikesForPosts = async (postIds) => {
    if (!postIds.length) return
    const { data: likesData } = await supabase
      .from('likes')
      .select('post_id, user_id')
      .in('post_id', postIds)

    if (likesData) {
      const likeCounts = {}
      const userLikes = {}
      likesData.forEach(like => {
        likeCounts[like.post_id] = (likeCounts[like.post_id] || 0) + 1
        if (like.user_id === session?.user?.id) userLikes[like.post_id] = true
      })
      setLikes(prev => ({ ...prev, ...likeCounts }))
      setLikedPosts(prev => ({ ...prev, ...userLikes }))
    }
  }

  const attachProfiles = async (postsData) => {
    const userIds = [...new Set(postsData.map(p => p.user_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds)
    const profileMap = {}
    profilesData?.forEach(p => profileMap[p.id] = p)
    return postsData.map(post => ({ ...post, profiles: profileMap[post.user_id] || null }))
  }

  const fetchPosts = async (reset = true) => {
    if (reset) {
      setLoading(true)
      setHasMore(true)
    } else {
      setLoadingMore(true)
    }

    const from = reset ? 0 : posts.length
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })

    if (activeSearchFilter?.type === 'location' && activeSearchFilter?.value) {
      query = query.eq('location', activeSearchFilter.value)
    }

    if (activeSearchFilter?.type === 'species' && activeSearchFilter?.value) {
      query = query.eq('species', activeSearchFilter.value)
    }

    const { data: postsData, error } = await query.range(from, to)

    if (!error && postsData) {
      if (postsData.length < PAGE_SIZE) setHasMore(false)

      const withProfiles = await attachProfiles(postsData)
      await fetchLikesForPosts(postsData.map(p => p.id))

      if (reset) {
        setPosts(withProfiles)
      } else {
        setPosts(prev => [...prev, ...withProfiles])
      }
    }

    setLoading(false)
    setLoadingMore(false)
    setRefreshing(false)
  }

  useEffect(() => {
    setPosts([])
    setLikes({})
    setLikedPosts({})
    fetchPosts(true)
  }, [session, searchFilterKey])

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

  const editFilteredSpecies = editSpeciesSearch.length > 1
    ? SPECIES.filter(s => s.toLowerCase().includes(editSpeciesSearch.toLowerCase())).slice(0, 6)
    : []

  const handleDeletePost = (postId) => {
    Alert.alert('Delete Post', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('posts').delete().eq('id', postId)
          setPosts(prev => prev.filter(p => p.id !== postId))
          setMenuPost(null)
        }
      }
    ])
  }

  const handleEditOpen = (post) => {
    setEditingPost(post)
    setEditCaption(post.caption || '')
    setEditLocation(post.location || '')
    setEditSpecies(post.species || '')
    setEditSpeciesSearch(post.species || '')
    setMenuPost(null)
  }

  const handleEditSave = async () => {
    if (!editingPost) return
    await supabase.from('posts').update({
      caption: editCaption,
      location: editLocation,
      species: editSpecies,
    }).eq('id', editingPost.id)
    setPosts(prev => prev.map(p =>
      p.id === editingPost.id
        ? { ...p, caption: editCaption, location: editLocation, species: editSpecies }
        : p
    ))
    setEditingPost(null)
  }

  const onRefresh = () => {
    setRefreshing(true)
    setLikes({})
    setLikedPosts({})
    fetchPosts(true)
  }

  const onEndReached = () => {
    if (!loadingMore && hasMore && !loading) {
      fetchPosts(false)
    }
  }

  const renderPost = useCallback(({ item: post }) => {
    const profile = post.profiles
    const liked = likedPosts[post.id]
    const likeCount = likes[post.id] || 0

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.postHeaderMain}
            onPress={() => navigation.navigate('ProfileView', { userId: post.user_id })}
          >
            <View style={styles.avatar}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
              ) : (
                <FishIcon size={16} color="#888" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.username}>
                {profile?.display_name || `@${profile?.username || 'unknown'}`}
              </Text>
              {post.location ? <Text style={styles.location}><LocationIcon size={12} color="#666" /> {post.location}</Text> : null}
            </View>
          </TouchableOpacity>
          {(post.user_id === session?.user?.id || post.species) ? (
            <View style={styles.headerMetaColumn}>
              <View style={styles.headerMetaTopRow}>
                <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
                {post.user_id === session?.user?.id ? (
                  <TouchableOpacity
                    style={styles.menuBtn}
                    onPress={() => setMenuPost(menuPost === post.id ? null : post.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.menuDots}>•••</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {post.species ? (
                <View style={styles.speciesBadge}>
                  <Text style={styles.speciesText}>{post.species}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Post action menu */}
        {menuPost === post.id && (
          <View style={styles.postMenu}>
            <TouchableOpacity style={styles.postMenuItem} onPress={() => handleEditOpen(post)}>
              <Text style={styles.postMenuText}>Edit Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.postMenuItem} onPress={() => handleDeletePost(post.id)}>
              <Text style={[styles.postMenuText, { color: '#ff3b5c' }]}>Delete Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.postMenuItem} onPress={() => setMenuPost(null)}>
              <Text style={[styles.postMenuText, { color: '#666' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {post.media_url ? (
          post.media_type === 'video' ? (
            <VideoPost uri={post.media_url} />
          ) : (
            <FramedPostImage
              uri={post.media_url}
              size={width}
              framing={normalizePostFraming(post.media_framing)}
              style={styles.postImage}
              fallbackResizeMode="contain"
            />
          )
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity onPress={() => handleLike(post.id)} style={styles.likeRow}>
            <HeartIcon size={22} color={liked ? '#ff3b5c' : '#333'} filled={liked} />
            {likeCount > 0 && <Text style={styles.likeCount}>{likeCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            const poster = profile?.display_name || `@${profile?.username || 'someone'}`
            const speciesText = post.species ? ` caught a ${post.species}` : ''
            const locationText = post.location ? ` at ${post.location}` : ''
            Share.share({
              message: `Check out this catch on LuckyFin! ${poster}${speciesText}${locationText}.\n\nDownload LuckyFin to see more: https://fishstagram.app`,
            })
          }}>
            <ShareIcon size={20} color="#333" />
          </TouchableOpacity>
        </View>

        {post.caption ? (
          <View style={styles.captionWrap}>
            <Text style={styles.captionUser}>{profile?.display_name || `@${profile?.username || 'unknown'}`}</Text>
            <Text style={styles.captionText}> {post.caption}</Text>
          </View>
        ) : null}

        <Comments postId={post.id} session={session} />
      </View>
    )
  }, [likedPosts, likes, session, menuPost])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#555" size="large" /></View>
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      {activeSearchFilter?.value ? (
        <View style={styles.filterBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.filterLabel}>{activeSearchFilter.type === 'location' ? 'LOCATION' : 'FISH TYPE'}</Text>
            <Text style={styles.filterValue}>{activeSearchFilter.value}</Text>
          </View>
          <TouchableOpacity
            style={styles.filterClearBtn}
            onPress={() => navigation.setParams({ searchFilter: undefined })}
          >
            <Text style={styles.filterClearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        renderItem={renderPost}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 100 }}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color="#555" style={{ padding: 20 }} /> : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No posts yet. Be the first!</Text>
          </View>
        }
      />

      {/* Edit Post Modal */}
      <Modal visible={!!editingPost} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Edit Post</Text>

              <Text style={styles.modalLabel}>CAPTION</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                value={editCaption}
                onChangeText={setEditCaption}
                placeholder="Caption..."
                placeholderTextColor="#555"
                multiline
              />

              <Text style={styles.modalLabel}>LOCATION</Text>
              <TextInput
                style={styles.modalInput}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="Location..."
                placeholderTextColor="#555"
              />

              <Text style={styles.modalLabel}>SPECIES</Text>
              <TextInput
                style={styles.modalInput}
                value={editSpeciesSearch}
                onChangeText={v => { setEditSpeciesSearch(v); setEditSpecies('') }}
                placeholder="Tag a species..."
                placeholderTextColor="#555"
              />
              {editSpecies ? <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}><CheckIcon size={14} color="#0891b2" /><Text style={styles.speciesConfirm}>{editSpecies}</Text></View> : null}

              {editFilteredSpecies.length > 0 && !editSpecies && (
                <View style={styles.suggestions}>
                  {editFilteredSpecies.map(name => (
                    <TouchableOpacity
                      key={name}
                      style={styles.suggestion}
                      onPress={() => { setEditSpecies(name); setEditSpeciesSearch(name) }}
                    >
                      <Text style={styles.suggestionText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleEditSave}>
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingPost(null)}>
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 60 },
  emptyText: { color: '#555', fontSize: 16 },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#111',
  },
  filterLabel: { ...type.label, color: '#666', fontSize: 11, marginBottom: 2 },
  filterValue: { ...type.bodyStrong, color: '#fff', fontSize: 16 },
  filterClearBtn: {
    borderWidth: 1,
    borderColor: 'rgba(8, 145, 178, 0.38)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(8, 145, 178, 0.12)',
  },
  filterClearText: { ...type.button, color: '#9ae7f7', fontSize: 12 },
  postCard: { borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingBottom: 16, marginBottom: 4 },
  postHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  postHeaderMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#222',
    alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden',
  },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { fontSize: 16 },
  username: { ...type.bodyStrong, color: '#fff', fontSize: 14 },
  location: { ...type.body, color: '#666', fontSize: 12, marginTop: 1 },
  time: { ...type.meta, color: '#444', fontSize: 11 },
  headerMetaColumn: { alignItems: 'flex-end', marginLeft: 10, minWidth: 96 },
  headerMetaTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  speciesBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 145, 178, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(120, 220, 255, 0.32)',
    shadowColor: '#062b35',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  speciesText: { ...type.bodyStrong, color: '#dffaff', fontSize: 11, letterSpacing: 0.2 },
  postImage: { width: width, height: width, backgroundColor: '#000' },
  actions: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeCount: { ...type.bodyMedium, color: '#aaa', fontSize: 14 },
  captionWrap: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 6, flexWrap: 'wrap' },
  captionUser: { ...type.bodyStrong, color: '#fff', fontSize: 14 },
  captionText: { ...type.body, color: '#ccc', fontSize: 14 },
  menuBtn: { padding: 4, paddingHorizontal: 8 },
  menuDots: { ...type.navLabel, color: '#666', fontSize: 16, letterSpacing: 1.8 },
  postMenu: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, marginHorizontal: 16, marginBottom: 8, overflow: 'hidden',
  },
  postMenuItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  postMenuText: { ...type.button, color: '#fff', fontSize: 15, textAlign: 'center' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '80%',
  },
  modalTitle: { ...type.navTitle, color: '#fff', fontSize: 18, marginBottom: 16, textAlign: 'center' },
  modalLabel: { ...type.label, color: '#666', fontSize: 11, marginBottom: 4, marginTop: 12 },
  modalInput: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10,
    padding: 12, color: '#fff', fontSize: 15, ...type.body,
  },
  speciesConfirm: { ...type.bodyMedium, color: '#0891b2', fontSize: 14, marginTop: 4 },
  suggestions: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 10, overflow: 'hidden', marginTop: 4,
  },
  suggestion: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  suggestionText: { ...type.body, color: '#fff', fontSize: 14 },
  modalButtons: { marginTop: 20, gap: 10 },
  modalSaveBtn: { backgroundColor: '#fff', borderRadius: 10, padding: 14, alignItems: 'center' },
  modalSaveBtnText: { ...type.button, color: '#000', fontSize: 15 },
  modalCancelBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 14, alignItems: 'center' },
  modalCancelBtnText: { ...type.button, color: '#666', fontSize: 15 },
})
