import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Dimensions
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { SPECIES } from '../lib/species'
import { type } from '../lib/typography'
import { CameraIcon, CheckIcon } from '../components/Icons'
import ImageCropper from '../components/ImageCropper'
import FramedPostImage from '../components/FramedPostImage'
import LocationSearchField from '../components/LocationSearchField'
import { resolveLocationQuery } from '../lib/locationSearch'

const PREVIEW_SIZE = Dimensions.get('window').width

export default function NewPostScreen({ session, navigation }) {
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [species, setSpecies] = useState('')
  const [speciesSearch, setSpeciesSearch] = useState('')
  const [image, setImage] = useState(null)
  const [imageFraming, setImageFraming] = useState(null)
  const [loading, setLoading] = useState(false)
  const [rawImage, setRawImage] = useState(null)
  const [showCropper, setShowCropper] = useState(false)

  const filtered = speciesSearch.length > 1
    ? SPECIES.filter(s => s.toLowerCase().includes(speciesSearch.toLowerCase())).slice(0, 6)
    : []

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      exif: false,
    })
    if (!result.canceled) {
      setRawImage(result.assets[0])
      setShowCropper(true)
    }
  }

  const handleCropDone = ({ image: framedImage, framing }) => {
    setImage(framedImage)
    setImageFraming(framing)
    setShowCropper(false)
    setRawImage(null)
  }

  const handlePost = async () => {
    if (!image) { Alert.alert('Please select a photo'); return }
    setLoading(true)

    try {
      let resolvedLocationLabel = location.trim()

      if (resolvedLocationLabel) {
        const resolvedLocation = selectedLocation?.label?.toLowerCase() === resolvedLocationLabel.toLowerCase()
          ? selectedLocation
          : await resolveLocationQuery(resolvedLocationLabel)

        if (!resolvedLocation) {
          setLoading(false)
          Alert.alert('Location not found', 'Choose a real place from the search results before posting.')
          return
        }

        resolvedLocationLabel = resolvedLocation.label
        setSelectedLocation(resolvedLocation)
        setLocation(resolvedLocation.label)
      }

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

      const postPayload = {
        user_id: session.user.id,
        caption,
        location: resolvedLocationLabel,
        species,
        media_url: urlData.publicUrl,
        media_type: 'image',
        media_framing: imageFraming,
      }

      let framingColumnMissing = false
      let { error: postError } = await supabase.from('posts').insert(postPayload)

      if (postError?.message?.includes('media_framing')) {
        framingColumnMissing = true
        const fallbackPayload = { ...postPayload }
        delete fallbackPayload.media_framing
        const fallbackInsert = await supabase.from('posts').insert(fallbackPayload)
        postError = fallbackInsert.error
      }

      if (postError) { Alert.alert('Post error', postError.message) }
      else {
        if (framingColumnMissing) {
          Alert.alert(
            'Database migration needed',
            'This post was uploaded, but saved framing is disabled until the media_framing migration is applied.'
          )
        }
        setCaption(''); setLocation(''); setSelectedLocation(null); setSpecies(''); setSpeciesSearch(''); setImage(null); setImageFraming(null)
        navigation.navigate('Feed')
      }
    } catch (e) {
      Alert.alert('Error', e.message)
    }
    setLoading(false)
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Image picker */}
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {image ? (
          <FramedPostImage uri={image.uri} size={PREVIEW_SIZE} framing={imageFraming} style={styles.preview} fallbackResizeMode="contain" />
        ) : (
          <View style={styles.placeholder}>
            <CameraIcon size={28} color="#555" />
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

        <LocationSearchField
          value={location}
          onChangeText={(value) => {
            setLocation(value)
            setSelectedLocation(null)
          }}
          onSelectLocation={(result) => {
            setSelectedLocation(result)
            setLocation(result.label)
          }}
          selectedLocation={selectedLocation}
          inputStyle={styles.input}
        />

        <TextInput
          style={styles.input}
          placeholder="Tag a species..."
          placeholderTextColor="#555"
          value={speciesSearch}
          onChangeText={v => { setSpeciesSearch(v); setSpecies('') }}
        />
        {species ? <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -4, gap: 4 }}><CheckIcon size={14} color="#0891b2" /><Text style={styles.speciesConfirm}>{species}</Text></View> : null}

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
    <ImageCropper
      visible={showCropper}
      imageUri={rawImage?.uri}
      onCrop={handleCropDone}
      onCancel={() => { setShowCropper(false); setRawImage(null) }}
    />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  imagePicker: { alignItems: 'center', paddingVertical: 24 },
  preview: { width: PREVIEW_SIZE, height: PREVIEW_SIZE, backgroundColor: '#000' },
  placeholder: {
    backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#333', borderStyle: 'dashed',
    borderRadius: 80, paddingHorizontal: 28, paddingVertical: 20, alignItems: 'center',
  },
  placeholderIcon: { fontSize: 28 },
  placeholderText: { ...type.bodyMedium, color: '#555', fontSize: 13, marginTop: 10 },
  form: { padding: 16, gap: 12 },
  input: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 12,
    padding: 14, color: '#fff', fontSize: 15, ...type.body,
  },
  speciesConfirm: { ...type.bodyMedium, color: '#0891b2', fontSize: 14, marginTop: -4 },
  suggestions: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, overflow: 'hidden', marginTop: -4,
  },
  suggestion: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  suggestionText: { ...type.body, color: '#fff', fontSize: 14 },
  postBtn: {
    backgroundColor: '#111a82', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4,
  },
  postBtnText: { ...type.button, color: '#f5f1f1', fontSize: 16, letterSpacing: 0.3 },
})
