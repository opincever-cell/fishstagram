import { useState } from 'react'
import { View, Image, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as ImageManipulator from 'expo-image-manipulator'
import { type } from '../lib/typography'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CROP_SIZE = SCREEN_WIDTH

export default function ImageCropper({ visible, imageUri, onCrop, onCancel }) {
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 })
  const [displaySize, setDisplaySize] = useState({ width: CROP_SIZE, height: CROP_SIZE })

  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const onImageLoad = (e) => {
    const { width: w, height: h } = e.nativeEvent.source
    setImageSize({ width: w, height: h })
    let dw, dh
    if (w / h > 1) {
      dh = CROP_SIZE
      dw = (w / h) * CROP_SIZE
    } else {
      dw = CROP_SIZE
      dh = (h / w) * CROP_SIZE
    }
    setDisplaySize({ width: dw, height: dh })
    resetValues()
  }

  const clamp = (val, min, max) => {
    'worklet'
    return Math.min(max, Math.max(min, val))
  }

  // Allow zoom out to 0.3x so large images can fit inside the frame
  const MIN_SCALE = 0.3
  const MAX_SCALE = 5

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE)
    })
    .onEnd(() => {
      savedScale.value = scale.value
      const s = scale.value
      const scaledW = displaySize.width * s
      const scaledH = displaySize.height * s
      // Only clamp if image is larger than crop area
      const maxX = scaledW > CROP_SIZE ? (scaledW - CROP_SIZE) / 2 : 0
      const maxY = scaledH > CROP_SIZE ? (scaledH - CROP_SIZE) / 2 : 0
      translateX.value = withSpring(clamp(translateX.value, -maxX, maxX))
      translateY.value = withSpring(clamp(translateY.value, -maxY, maxY))
      savedTranslateX.value = clamp(translateX.value, -maxX, maxX)
      savedTranslateY.value = clamp(translateY.value, -maxY, maxY)
    })

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX
      translateY.value = savedTranslateY.value + e.translationY
    })
    .onEnd(() => {
      const s = scale.value
      const scaledW = displaySize.width * s
      const scaledH = displaySize.height * s
      const maxX = scaledW > CROP_SIZE ? (scaledW - CROP_SIZE) / 2 : 0
      const maxY = scaledH > CROP_SIZE ? (scaledH - CROP_SIZE) / 2 : 0
      const cx = clamp(translateX.value, -maxX, maxX)
      const cy = clamp(translateY.value, -maxY, maxY)
      translateX.value = withSpring(cx)
      translateY.value = withSpring(cy)
      savedTranslateX.value = cx
      savedTranslateY.value = cy
    })

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  const handleCrop = async () => {
    try {
      const { width: origW, height: origH } = imageSize
      const longestSide = Math.max(origW, origH)
      const resizeAction = longestSide > 1440
        ? (origW >= origH ? { resize: { width: 1440 } } : { resize: { height: 1440 } })
        : null

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        resizeAction ? [resizeAction] : [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      )

      const resizedWidth = resizeAction
        ? (origW >= origH ? 1440 : Math.round((origW / origH) * 1440))
        : origW
      const resizedHeight = resizeAction
        ? (origW >= origH ? Math.round((origH / origW) * 1440) : 1440)
        : origH

      onCrop({
        image: {
          uri: result.uri,
          mimeType: 'image/jpeg',
          width: resizedWidth,
          height: resizedHeight,
        },
        framing: {
          version: 1,
          imageWidth: resizedWidth,
          imageHeight: resizedHeight,
          scale: scale.value,
          translateXRatio: translateX.value / CROP_SIZE,
          translateYRatio: translateY.value / CROP_SIZE,
        },
      })
    } catch (e) {
      console.warn('Image framing error:', e)
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1440 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      )
      onCrop({
        image: {
          uri: result.uri,
          mimeType: 'image/jpeg',
          width: result.width,
          height: result.height,
        },
        framing: {
          version: 1,
          imageWidth: result.width,
          imageHeight: result.height,
          scale: 1,
          translateXRatio: 0,
          translateYRatio: 0,
        },
      })
    }
  }

  const resetValues = () => {
    scale.value = 1
    savedScale.value = 1
    translateX.value = 0
    translateY.value = 0
    savedTranslateX.value = 0
    savedTranslateY.value = 0
  }

  if (!visible || !imageUri) return null

  const third = CROP_SIZE / 3

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { resetValues(); onCancel() }}>
          <Text style={styles.headerBtn}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Adjust</Text>
        <TouchableOpacity onPress={handleCrop}>
          <Text style={[styles.headerBtn, { color: '#0891b2' }]}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cropArea}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.imageContainer, animatedStyle]}>
            <Image
              source={{ uri: imageUri }}
              style={{ width: displaySize.width, height: displaySize.height }}
              resizeMode="cover"
              onLoad={onImageLoad}
            />
          </Animated.View>
        </GestureDetector>

        {/* Grid overlay - rule of thirds */}
        <View style={styles.gridOverlay} pointerEvents="none">
          {/* Border */}
          <View style={styles.gridBorder} />
          {/* Vertical lines */}
          <View style={[styles.gridLineV, { left: third }]} />
          <View style={[styles.gridLineV, { left: third * 2 }]} />
          {/* Horizontal lines */}
          <View style={[styles.gridLineH, { top: third }]} />
          <View style={[styles.gridLineH, { top: third * 2 }]} />
        </View>
      </View>

      <Text style={styles.hint}>Pinch to zoom · Drag to position</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0a0a0a', zIndex: 999, elevation: 999,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16,
  },
  headerBtn: { ...type.button, color: '#fff', fontSize: 16 },
  headerTitle: { ...type.navTitle, color: '#fff', fontSize: 17 },
  cropArea: {
    width: CROP_SIZE, height: CROP_SIZE,
    overflow: 'hidden', backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  imageContainer: {
    alignItems: 'center', justifyContent: 'center',
  },
  gridOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  gridBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  gridLineV: {
    position: 'absolute', top: 0, bottom: 0, width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  gridLineH: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  hint: { ...type.body, color: '#555', fontSize: 13, textAlign: 'center', marginTop: 16 },
})
