import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ScrollView, ActivityIndicator, Alert, FlatList
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { SPECIES } from '../lib/species'

export default function NewPostScreen({ session, navigation }) {
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [species, setSpecies] = useState('')
  const [speciesSearch, setSpeciesSearch] = useState('')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)

  const filtered = speciesSearch.length > 1
    ? SPECIES.filter(s => s.toLowerCase().includes(speciesSearch.toLowerCase())).slice(0, 6)
    : []

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    })
    if (!result.canceled) {
      setImage(result.assets[0])
    }
  }

  const handlePost = async () => {
    if (!image) { Alert.alert('Please select a photo'); return }
    setLoading(true)

    try {
      const ext = image.uri.split('.').pop() || 'jpg'
      const fileName = `${session.user.id}-${Date.now()}.${ext}`

      const response = await fetch(image.uri)
      const blob = await response.blob()
      const arrayBuffer = await new Response(blob).arrayBuffer()

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, arrayBuffer, {
          contentType: image.mimeType || 'image/jpeg',
        })

      if (uploadError) { Alert.alert('Upload error', uploadError.message); setLoading(false); return }

      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(fileName)

      const { error: postError } = await supabase.from('posts').insert({
        user_id: session.user.id,
        caption,
        location,
        species,
        media_url: urlData.publicUrl,
        media_type: 'image',
      })

      if (postError) { Alert.alert('Post error', postError.message) }
      else {
        setCaption(''); setLocation(''); setSpecies(''); setSpeciesSearch(''); setImage(null)
        navigation.navigate('Feed')
      }
    } catch (e) {
      Alert.alert('Error', e.message)
    }
    setLoading(false)
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Image picker */}
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>Tap to add photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Share your catch story..."
          placeholderTextColor="#555"
          value={caption}
          onChangeText={setCaption}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder="📍 Location..."
          placeholderTextColor="#555"
          value={location}
          onChangeText={setLocation}
        />

        <TextInput
          style={styles.input}
          placeholder="🐟 Tag a species..."
          placeholderTextColor="#555"
          value={speciesSearch}
          onChangeText={v => { setSpeciesSearch(v); setSpecies('') }}
        />
        {species ? <Text style={styles.speciesConfirm}>✓ {species}</Text> : null}

        {filtered.length > 0 && !species && (
          <View style={styles.suggestions}>
            {filtered.map(name => (
              <TouchableOpacity
                key={name}
                style={styles.suggestion}
                onPress={() => { setSpecies(name); setSpeciesSearch(name) }}
              >
                <Text style={styles.suggestionText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.postBtn, loading && { backgroundColor: '#222' }]}
          onPress={handlePost}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#555" />
          ) : (
            <Text style={styles.postBtnText}>POST</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  imagePicker: { alignItems: 'center', paddingVertical: 24 },
  preview: { width: '100%', height: 300, backgroundColor: '#111' },
  placeholder: {
    backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#333', borderStyle: 'dashed',
    borderRadius: 80, paddingHorizontal: 28, paddingVertical: 20, alignItems: 'center',
  },
  placeholderIcon: { fontSize: 28 },
  placeholderText: { color: '#555', fontSize: 13, fontWeight: '600', marginTop: 10 },
  form: { padding: 16, gap: 12 },
  input: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 12,
    padding: 14, color: '#fff', fontSize: 15,
  },
  speciesConfirm: { color: '#0891b2', fontSize: 14, marginTop: -4 },
  suggestions: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, overflow: 'hidden', marginTop: -4,
  },
  suggestion: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  suggestionText: { color: '#fff', fontSize: 14 },
  postBtn: {
    backgroundColor: '#111a82', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4,
  },
  postBtnText: { color: '#f5f1f1', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
})
