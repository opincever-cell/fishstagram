import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/utils'

export default function Comments({ postId, session }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [commentLikes, setCommentLikes] = useState({})
  const [likedComments, setLikedComments] = useState({})

  useEffect(() => {
    if (!open) return
    const getComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        // Batch fetch all profiles at once instead of one by one
        const userIds = [...new Set(data.map(c => c.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds)
        const profileMap = {}
        profiles?.forEach(p => profileMap[p.id] = p)
        const withProfiles = data.map(c => ({ ...c, profiles: profileMap[c.user_id] || null }))
        setComments(withProfiles)

        // Batch fetch comment likes
        const commentIds = data.map(c => c.id)
        const { data: likesData } = await supabase
          .from('comment_likes')
          .select('comment_id, user_id')
          .in('comment_id', commentIds)

        if (likesData) {
          const likeCounts = {}
          const userLikes = {}
          likesData.forEach(like => {
            likeCounts[like.comment_id] = (likeCounts[like.comment_id] || 0) + 1
            if (like.user_id === session?.user?.id) userLikes[like.comment_id] = true
          })
          setCommentLikes(likeCounts)
          setLikedComments(userLikes)
        }
      } else {
        setComments([])
      }
      setLoading(false)
    }
    getComments()
  }, [postId, open])

  const handleComment = async () => {
    if (!newComment.trim()) return
    const { data, error } = await supabase
      .from('comments')
      .insert({ user_id: session.user.id, post_id: postId, content: newComment })
      .select('*')
      .single()

    if (!error && data) {
      const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single()
      if (post && post.user_id !== session.user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, actor_id: session.user.id, type: 'comment', post_id: postId,
        })
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', session.user.id)
        .single()
      setComments(prev => [...prev, { ...data, profiles: profile }])
      setNewComment('')
    }
  }

  const handleCommentLike = async (commentId) => {
    if (!session) return
    const alreadyLiked = likedComments[commentId]
    setLikedComments(prev => ({ ...prev, [commentId]: !alreadyLiked }))
    setCommentLikes(prev => ({ ...prev, [commentId]: (prev[commentId] || 0) + (alreadyLiked ? -1 : 1) }))
    if (alreadyLiked) {
      await supabase.from('comment_likes').delete().eq('user_id', session.user.id).eq('comment_id', commentId)
    } else {
      await supabase.from('comment_likes').insert({ user_id: session.user.id, comment_id: commentId })
    }
  }

  const handleDeleteComment = async (commentId) => {
    await supabase.from('comments').delete().eq('id', commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setOpen(!open)}>
        <Text style={styles.toggle}>{open ? 'Hide comments' : 'View comments'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.commentsWrap}>
          {loading ? (
            <ActivityIndicator color="#555" style={{ marginVertical: 8 }} />
          ) : comments.length === 0 ? (
            <Text style={styles.empty}>No comments yet.</Text>
          ) : (
            comments.map(comment => (
              <View key={comment.id} style={styles.comment}>
                <View style={styles.commentBody}>
                  <Text style={styles.commentUser}>
                    {comment.profiles?.display_name || `@${comment.profiles?.username || 'unknown'}`}
                  </Text>
                  <Text style={styles.commentText}> {comment.content}</Text>
                  <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
                </View>
                <View style={styles.commentActions}>
                  <TouchableOpacity onPress={() => handleCommentLike(comment.id)}>
                    <Text style={{ color: likedComments[comment.id] ? '#ff3b5c' : '#333', fontSize: 14 }}>♥</Text>
                  </TouchableOpacity>
                  {commentLikes[comment.id] > 0 && (
                    <Text style={styles.commentLikeCount}>{commentLikes[comment.id]}</Text>
                  )}
                  {session?.user?.id === comment.user_id && (
                    <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                      <Text style={styles.deleteBtn}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}

          {session && (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Add a comment..."
                placeholderTextColor="#555"
                value={newComment}
                onChangeText={setNewComment}
                onSubmitEditing={handleComment}
                returnKeyType="send"
              />
              <TouchableOpacity style={styles.postBtn} onPress={handleComment}>
                <Text style={styles.postBtnText}>Post</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 8 },
  toggle: { color: '#666', fontSize: 13 },
  commentsWrap: { marginTop: 12 },
  empty: { color: '#555', fontSize: 13 },
  comment: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-start' },
  commentBody: { flex: 1 },
  commentUser: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentText: { color: '#ccc', fontSize: 13 },
  commentTime: { color: '#444', fontSize: 11, marginTop: 2 },
  commentActions: { alignItems: 'center', gap: 4, marginLeft: 8 },
  commentLikeCount: { color: '#aaa', fontSize: 11 },
  deleteBtn: { color: '#444', fontSize: 11 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: {
    flex: 1, padding: 8, paddingHorizontal: 12, backgroundColor: '#1a1a1a',
    borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8, color: '#fff', fontSize: 13,
  },
  postBtn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  postBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
})