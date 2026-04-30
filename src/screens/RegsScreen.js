import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, AppState,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { type } from '../lib/typography'
import { StarIcon } from '../components/Icons'
import { STATE_FLAG_PNGS } from '../lib/stateFlagPngs'
import { STATE_FLAGS, buildRows } from '../lib/guidebookData'

export default function RegsScreen({ session, navigation }) {
  const [favoriteState, setFavoriteState] = useState(null)
  const didAutoNav = useRef(false)

  const loadFavorite = useCallback(async () => {
    try {
      if (!session) return
      const { data } = await supabase
        .from('profiles').select('home_state').eq('id', session.user.id).single()
      setFavoriteState(data?.home_state || null)
    } catch (e) {}
  }, [session])

  useEffect(() => {
    loadFavorite()
  }, [loadFavorite])

  // Reset the auto-nav gate whenever the app comes back to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') didAutoNav.current = false
    })
    return () => sub.remove()
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadFavorite()
      if (didAutoNav.current || !session) return
      const autoNav = async () => {
        try {
          const { data } = await supabase
            .from('profiles').select('home_state').eq('id', session.user.id).single()
          if (data?.home_state) {
            didAutoNav.current = true
            navigation.navigate('StateGuide', { stateName: data.home_state })
          }
        } catch (e) {}
      }
      autoNav()
    }, [session, navigation, loadFavorite])
  )

  const openStateGuide = (state) => {
    navigation.navigate('StateGuide', { stateName: state })
  }

  const rows = buildRows(STATE_FLAGS)

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={styles.subtitle}>Select a state for Rules & Regulations</Text>

        <View style={styles.flagsSection}>
          {rows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={[styles.flagRow, row.length < 3 && styles.flagRowCentered]}>
              {row.map((state) => {
                const selected = favoriteState === state.name

                return (
                  <TouchableOpacity
                    key={state.name}
                    style={[styles.flagTile, selected && styles.flagTileActive]}
                    onPress={() => openStateGuide(state.name)}
                    activeOpacity={0.9}
                  >
                    <Image source={STATE_FLAG_PNGS[state.name]} style={styles.flagImage} resizeMode="cover" />
                    <View style={styles.flagBadge}>
                      <Text style={styles.flagBadgeText}>{state.abbr}</Text>
                    </View>
                    {favoriteState === state.name ? (
                      <View style={styles.favoriteBadge}>
                        <StarIcon size={12} color="#f3c14b" filled />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                )
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  subtitle: { ...type.navTitle, color: '#fff', fontSize: 22, marginBottom: 20 },
  flagsSection: { marginBottom: 14 },
  flagRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  flagRowCentered: { justifyContent: 'center', gap: 10 },
  flagTile: {
    width: '31.5%',
    aspectRatio: 1.45,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#262626',
    position: 'relative',
    overflow: 'hidden',
  },
  flagTileActive: {
    borderColor: '#d4a733',
    borderWidth: 2,
  },
  flagImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#202020',
  },
  flagBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.56)',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  flagBadgeText: { ...type.label, color: '#fff', fontSize: 9 },
  favoriteBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
