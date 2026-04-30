import { useState, useEffect } from 'react'
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, ActivityIndicator, Dimensions, FlatList, Alert, Modal, Share
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/utils'
import { SPECIES } from '../lib/species'
import { normalizePostFraming } from '../lib/postMedia'
import { type } from '../lib/typography'
import Comments from '../components/Comments'
import FramedPostImage from '../components/FramedPostImage'
import { FishIcon, LocationIcon, CheckIcon, ShareIcon, MoreIcon } from '../components/Icons'

const { width } = Dimensions.get('window')
const GRID_SIZE = width / 3

export default function ProfileScreen({ session, route, navigation }) {
  const viewingId = route?.params?.userId
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [posts, setPosts] = useState([])
  const [view, setView] = useState('grid')
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)

  const [menuPost, setMenuPost] = useState(null)
  const [editingPost, setEditingPost] = useState(null)
  const [editCaption, setEditCaption] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editSpecies, setEditSpecies] = useState('')
  const [editSpeciesSearch, setEditSpeciesSearch] = useState('')
  const [hasMorePosts, setHasMorePosts] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const PROFILE_PAGE_SIZE = 12
  const profileId = viewingId || session.user.id
  const isOwnProfile = profileId === session.user.id

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

  useEffect(() => {
    setLoading(true)
    setView('grid')
    setEditing(false)
    const getProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, bio')
        .eq('id', profileId)
        .single()
      if (data) {
        setUsername(data.username || '')
        setDisplayName(data.display_name || '')
        setAvatarUrl(data.avatar_url || '')
        setBio(data.bio || '')
      }

      const { data: postData } = await supabase
        .from('posts').select('*').eq('user_id', profileId).order('created_at', { ascending: false }).range(0, PROFILE_PAGE_SIZE - 1)
      if (postData) {
        setPosts(postData)
        setHasMorePosts(postData.length >= PROFILE_PAGE_SIZE)
      }

      const { count: followers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId)
      setFollowerCount(followers || 0)

      const { count: following } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId)
      setFollowingCount(following || 0)

      if (!isOwnProfile) {
        const { data: followCheck } = await supabase
          .from('follows').select('id')
          .eq('follower_id', session.user.id).eq('following_id', profileId).single()
        setIsFollowing(!!followCheck)
      }
      setLoading(false)
    }
    getProfile()
  }, [profileId])

  const handleFollow = async () => {
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', profileId)
      setIsFollowing(false)
      setFollowerCount(prev => prev - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: session.user.id, following_id: profileId })
      setIsFollowing(true)
      setFollowerCount(prev => prev + 1)
      await supabase.from('notifications').insert({ user_id: profileId, actor_id: session.user.id, type: 'follow' })
    }
  }

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      exif: false,
    })
    if (!result.canceled) {
      const asset = result.assets[0]
      const ext = asset.uri.split('.').pop() || 'jpg'
      const fileName = 'avatar-' + session.user.id + '.' + ext

      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const arrayBuffer = await new Response(blob).arrayBuffer()

      const { error } = await supabase.storage.from('posts').upload(fileName, arrayBuffer, {
        upsert: true, contentType: asset.mimeType || 'image/jpeg',
      })
      if (error) { Alert.alert('Upload error', error.message); return }
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)
      setAvatarUrl(urlData.publicUrl + '?t=' + Date.now())
    }
  }

  const saveProfile = async () => {
    // Validate username
    const cleanUsername = username.trim().toLowerCase()
    if (cleanUsername && (cleanUsername.length < 3 || cleanUsername.length > 30)) {
      setMessage('Username must be 3-30 characters'); return
    }
    if (cleanUsername && !/^[a-z0-9._]+$/.test(cleanUsername)) {
      setMessage('Username: letters, numbers, dots and underscores only'); return
    }
    if (displayName.trim().length > 50) {
      setMessage('Display name must be under 50 characters'); return
    }
    if (bio.length > 160) {
      setMessage('Bio must be under 160 characters'); return
    }
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id, username: cleanUsername, display_name: displayName.trim(), avatar_url: avatarUrl, bio: bio.trim(),
    })
    if (error) setMessage(error.message)
    else {
      setUsername(cleanUsername)
      setDisplayName(displayName.trim())
      setBio(bio.trim())
      setMessage('Saved!'); setEditing(false); setTimeout(() => setMessage(''), 2000)
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const loadMorePosts = async () => {
    if (loadingMore || !hasMorePosts) return
    setLoadingMore(true)
    const { data } = await supabase
      .from('posts').select('*').eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .range(posts.length, posts.length + PROFILE_PAGE_SIZE - 1)
    if (data) {
      setPosts(prev => [...prev, ...data])
      setHasMorePosts(data.length >= PROFILE_PAGE_SIZE)
    }
    setLoadingMore(false)
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#555" size="large" /></View>
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ position: 'relative' }}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <FishIcon size={32} color="#888" />
              )}
            </View>
            {isOwnProfile && editing && (
              <TouchableOpacity
                onPress={pickAvatar}
                style={styles.avatarOverlay}
                activeOpacity={0.7}
              >
                <MoreIcon size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flex: 1 }}>
            {displayName ? <Text style={styles.displayName}>{displayName}</Text> : null}
            <Text style={styles.usernameText}>@{username || 'unnamed'}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}><Text style={styles.statBold}>{posts.length}</Text> posts</Text>
              <Text style={styles.stat}><Text style={styles.statBold}>{followerCount}</Text> followers</Text>
              <Text style={styles.stat}><Text style={styles.statBold}>{followingCount}</Text> following</Text>
            </View>
          </View>
        </View>

        {bio ? <Text style={styles.bio}>{bio}</Text> : null}

        {isOwnProfile ? (
          <View style={styles.ownActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(!editing)}>
              <Text style={styles.editBtnText}>{editing ? 'Cancel' : 'Edit Profile'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.otherActions}>
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
              onPress={handleFollow}
            >
              <Text style={[styles.followBtnText, isFollowing && { color: '#fff' }]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Edit Form */}
        {isOwnProfile && editing && (
          <View style={styles.editForm}>
            <Text style={styles.label}>DISPLAY NAME</Text>
            <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholderTextColor="#555" placeholder="Display name" />
            <Text style={styles.label}>BIO</Text>
            <TextInput style={styles.input} value={bio} onChangeText={setBio} placeholderTextColor="#555" placeholder="Bio" />
            <Text style={styles.label}>USERNAME</Text>
            <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholderTextColor="#555" placeholder="Username" autoCapitalize="none" />
            <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
        )}
      </View>

      {/* View toggle */}
      <View style={styles.toggleRow}>
        {['grid', 'timeline'].map(v => (
          <TouchableOpacity key={v} style={[styles.toggleBtn, view === v && styles.toggleActive]} onPress={() => setView(v)}>
            <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>{v.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Posts */}
      {posts.length === 0 ? (
        <Text style={styles.noPosts}>No posts yet.</Text>
      ) : view === 'grid' ? (
        <View style={styles.grid}>
          {posts.map(post => (
            <TouchableOpacity key={post.id} onPress={() => setView('timeline')}>
              <Image source={{ uri: post.media_url }} style={styles.gridItem} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        posts.map(post => (
          <View key={post.id} style={styles.timelinePost}>
            {isOwnProfile && (
              <View style={styles.timelineHeader}>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.menuBtn}
                  onPress={() => setMenuPost(menuPost === post.id ? null : post.id)}
                >
                  <Text style={styles.menuDots}>•••</Text>
                </TouchableOpacity>
              </View>
            )}
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
            {post.media_type === 'image' && post.media_url ? (
              <FramedPostImage
                uri={post.media_url}
                size={width}
                framing={normalizePostFraming(post.media_framing)}
                style={styles.timelineImage}
                fallbackResizeMode="contain"
              />
            ) : null}
            <View style={styles.timelineActions}>
              <TouchableOpacity onPress={() => {
                const poster = displayName || `@${username || 'someone'}`
                const speciesText = post.species ? ` caught a ${post.species}` : ''
                const locationText = post.location ? ` at ${post.location}` : ''
                Share.share({
                  message: `Check out this catch on LuckyFin! ${poster}${speciesText}${locationText}.\n\nDownload LuckyFin to see more: https://fishstagram.app`,
                })
              }}>
                <ShareIcon size={20} color="#555" />
              </TouchableOpacity>
            </View>
            <View style={styles.timelineInfo}>
              {post.location ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><LocationIcon size={12} color="#666" /><Text style={styles.timelineLocation}>{post.location}</Text></View> : null}
              {post.caption ? <Text style={styles.timelineCaption}>{post.caption}</Text> : null}
              {post.species ? (
                <View style={[styles.speciesBadge, { marginTop: 4 }]}>
                  <Text style={styles.speciesText}>{post.species}</Text>
                </View>
              ) : null}
              <Text style={styles.timelineTime}>{timeAgo(post.created_at)}</Text>
            </View>
            <Comments postId={post.id} session={session} />
          </View>
        ))
      )}
      {hasMorePosts && posts.length > 0 && (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMorePosts}>
          <Text style={styles.loadMoreText}>{loadingMore ? 'Loading...' : 'Load more'}</Text>
        </TouchableOpacity>
      )}
      <View style={{ height: 100 }} />

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
                <View style={styles.editSuggestions}>
                  {editFilteredSpecies.map(name => (
                    <TouchableOpacity
                      key={name}
                      style={styles.editSuggestion}
                      onPress={() => { setEditSpecies(name); setEditSpeciesSearch(name) }}
                    >
                      <Text style={styles.editSuggestionText}>{name}</Text>
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center', marginRight: 20, overflow: 'hidden',
  },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFallback: { fontSize: 32 },
  displayName: { ...type.navTitle, color: '#fff', fontSize: 18 },
  usernameText: { ...type.bodyMedium, color: '#aaa', fontSize: 14, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  stat: { color: '#555', fontSize: 13 },
  statBold: { ...type.bodyStrong, color: '#fff' },
  bio: { ...type.body, color: '#aaa', fontSize: 14, marginBottom: 12 },
  ownActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flex: 1, borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 8, alignItems: 'center' },
  editBtnText: { ...type.button, color: '#fff', fontSize: 13 },
  logoutBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 8, paddingHorizontal: 14 },
  logoutBtnText: { color: '#666', fontSize: 13 },
  otherActions: { flexDirection: 'row', gap: 8 },
  followBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 8, alignItems: 'center' },
  followingBtn: { backgroundColor: '#0891b2' },
  followBtnText: { ...type.button, color: '#000', fontSize: 13 },
  editForm: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 20 },
  avatarPicker: { marginBottom: 16 },
  avatarPickerText: { ...type.body, color: '#aaa', fontSize: 14 },
  label: { ...type.label, color: '#666', fontSize: 11, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8,
    padding: 10, color: '#fff', fontSize: 14, marginBottom: 4, ...type.body,
  },
  saveBtn: { backgroundColor: '#fff', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { ...type.button, color: '#000', fontSize: 14 },
  message: { ...type.bodyMedium, color: '#4ade80', fontSize: 13, marginTop: 8 },
  toggleRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  toggleBtn: { flex: 1, padding: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  toggleActive: { borderBottomColor: '#fff' },
  toggleText: { ...type.navLabel, color: '#555', fontSize: 12 },
  toggleTextActive: { color: '#fff' },
  noPosts: { color: '#555', fontSize: 14, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: GRID_SIZE, height: GRID_SIZE, backgroundColor: '#1a1a1a' },
  timelinePost: { borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingBottom: 16, marginBottom: 4 },
  timelineImage: { width: width, height: width, backgroundColor: '#000' },
  timelineActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 10 },
  timelineInfo: { paddingHorizontal: 16, paddingTop: 8 },
  timelineLocation: { ...type.body, color: '#666', fontSize: 13 },
  timelineCaption: { ...type.body, color: '#ccc', fontSize: 14, marginTop: 4 },
  timelineTime: { ...type.meta, color: '#444', fontSize: 11, marginTop: 4 },
  timelineHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuBtn: { padding: 4, paddingHorizontal: 8 },
  menuDots: { ...type.navLabel, color: '#666', fontSize: 16, letterSpacing: 1.8 },
  postMenu: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, marginHorizontal: 16, marginBottom: 8, overflow: 'hidden',
  },
  postMenuItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  postMenuText: { ...type.button, color: '#fff', fontSize: 15, textAlign: 'center' },
  speciesBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
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
  speciesConfirm: { ...type.bodyMedium, color: '#0891b2', fontSize: 14, marginTop: 4 },
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
  editSuggestions: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 10, overflow: 'hidden', marginTop: 4,
  },
  editSuggestion: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  editSuggestionText: { ...type.body, color: '#fff', fontSize: 14 },
  modalButtons: { marginTop: 20, gap: 10 },
  modalSaveBtn: { backgroundColor: '#fff', borderRadius: 10, padding: 14, alignItems: 'center' },
  modalSaveBtnText: { ...type.button, color: '#000', fontSize: 15 },
  modalCancelBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 14, alignItems: 'center' },
  modalCancelBtnText: { ...type.button, color: '#666', fontSize: 15 },
  loadMoreBtn: { padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  loadMoreText: { ...type.bodyMedium, color: '#555', fontSize: 13 },
})
