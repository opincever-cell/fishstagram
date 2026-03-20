import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking
} from 'react-native'
import { supabase } from '../lib/supabase'
import { Picker } from '@react-native-picker/picker'

const REGS = {
  'Alabama': { agency: 'AL Dept. of Conservation', link: 'https://www.outdooralabama.com/fishing' },
  'Alaska': { agency: 'Alaska Dept. of Fish & Game', link: 'https://www.adfg.alaska.gov/index.cfm?adfg=fishing.main' },
  'Arizona': { agency: 'AZ Game & Fish Dept.', link: 'https://www.azgfd.com/fishing-2/' },
  'Arkansas': { agency: 'Arkansas Game & Fish Commission', link: 'https://www.agfc.com/fishing' },
  'California': { agency: 'CA Dept. of Fish & Wildlife', link: 'https://wildlife.ca.gov/Fishing' },
  'Colorado': { agency: 'Colorado Parks & Wildlife', link: 'https://cpw.state.co.us/thingstodo/Pages/Fishing.aspx' },
  'Connecticut': { agency: 'CT DEEP', link: 'https://portal.ct.gov/DEEP/Fishing' },
  'Delaware': { agency: 'Delaware DNREC', link: 'https://dnrec.delaware.gov/fish-wildlife/fishing' },
  'Florida': { agency: 'Florida Fish & Wildlife Commission', link: 'https://myfwc.com/fishing' },
  'Georgia': { agency: 'GA Dept. of Natural Resources', link: 'https://georgiawildlife.com/fishing' },
  'Hawaii': { agency: 'Hawaii Division of Aquatic Resources', link: 'https://dlnr.hawaii.gov/dar/fishing' },
  'Idaho': { agency: 'Idaho Fish & Game', link: 'https://idfg.idaho.gov/fish' },
  'Illinois': { agency: 'Illinois DNR', link: 'https://dnr.illinois.gov/fishing' },
  'Indiana': { agency: 'Indiana DNR', link: 'https://www.in.gov/dnr/fish-and-wildlife/fishing' },
  'Iowa': { agency: 'Iowa DNR', link: 'https://www.iowadnr.gov/Fishing' },
  'Kansas': { agency: 'Kansas Dept. of Wildlife & Parks', link: 'https://ksoutdoors.com/Fishing' },
  'Kentucky': { agency: 'Kentucky Dept. Fish & Wildlife', link: 'https://fw.ky.gov/Fish' },
  'Louisiana': { agency: 'Louisiana Dept. Wildlife & Fisheries', link: 'https://www.wlf.louisiana.gov/page/fishing' },
  'Maine': { agency: 'Maine Dept. Inland Fisheries & Wildlife', link: 'https://www.maine.gov/ifw/fishing-boating/fishing' },
  'Maryland': { agency: 'Maryland DNR', link: 'https://dnr.maryland.gov/fisheries' },
  'Massachusetts': { agency: 'MA Division of Fisheries & Wildlife', link: 'https://www.mass.gov/fishing' },
  'Michigan': { agency: 'Michigan DNR', link: 'https://www.michigan.gov/dnr/things-to-do/fishing' },
  'Minnesota': { agency: 'Minnesota DNR', link: 'https://www.dnr.state.mn.us/fishing' },
  'Mississippi': { agency: 'MS Dept. Wildlife Fisheries & Parks', link: 'https://www.mdwfp.com/fishing-boating' },
  'Missouri': { agency: 'Missouri Dept. of Conservation', link: 'https://mdc.mo.gov/fishing' },
  'Montana': { agency: 'Montana Fish Wildlife & Parks', link: 'https://fwp.mt.gov/fish' },
  'Nebraska': { agency: 'Nebraska Game & Parks', link: 'https://outdoornebraska.gov/fishing' },
  'Nevada': { agency: 'Nevada Dept. Wildlife', link: 'https://www.ndow.org/fishing' },
  'New Hampshire': { agency: 'NH Fish & Game', link: 'https://www.wildlife.nh.gov/fishing-new-hampshire' },
  'New Jersey': { agency: 'NJ Division of Fish & Wildlife', link: 'https://dep.nj.gov/njfw/fishing' },
  'New Mexico': { agency: 'NM Dept. of Game & Fish', link: 'https://wildlife.dgf.nm.gov/fishing' },
  'New York': { agency: 'NY DEC', link: 'https://dec.ny.gov/things-to-do/freshwater-fishing' },
  'North Carolina': { agency: 'NC Wildlife Resources Commission', link: 'https://www.ncwildlife.org/Fishing' },
  'North Dakota': { agency: 'ND Game & Fish', link: 'https://gf.nd.gov/fishing' },
  'Ohio': { agency: 'Ohio DNR', link: 'https://ohiodnr.gov/discover-and-learn/safety-conservation/fishing' },
  'Oklahoma': { agency: 'Oklahoma Dept. Wildlife Conservation', link: 'https://www.wildlifedepartment.com/fishing' },
  'Oregon': { agency: 'Oregon Dept. Fish & Wildlife', link: 'https://myodfw.com/fishing' },
  'Pennsylvania': { agency: 'PA Fish & Boat Commission', link: 'https://www.fishandboat.com/Fishing' },
  'Rhode Island': { agency: 'RI DEM', link: 'https://dem.ri.gov/fishing' },
  'South Carolina': { agency: 'SC DNR', link: 'https://www.dnr.sc.gov/fishing' },
  'South Dakota': { agency: 'SD Game Fish & Parks', link: 'https://gfp.sd.gov/fishing' },
  'Tennessee': { agency: 'Tennessee TWRA', link: 'https://www.tn.gov/twra/fishing' },
  'Texas': { agency: 'Texas Parks & Wildlife', link: 'https://tpwd.texas.gov/fishboat/fish' },
  'Utah': { agency: 'Utah Division of Wildlife Resources', link: 'https://wildlife.utah.gov/fishing' },
  'Vermont': { agency: 'Vermont Fish & Wildlife', link: 'https://vtfishandwildlife.com/fish' },
  'Virginia': { agency: 'Virginia DWR', link: 'https://dwr.virginia.gov/fishing' },
  'Washington': { agency: 'Washington DFW', link: 'https://wdfw.wa.gov/fishing' },
  'West Virginia': { agency: 'WV Division of Natural Resources', link: 'https://wvdnr.gov/fishing' },
  'Wisconsin': { agency: 'Wisconsin DNR', link: 'https://dnr.wisconsin.gov/topic/fishing' },
  'Wyoming': { agency: 'Wyoming Game & Fish', link: 'https://wgfd.wyo.gov/fishing' },
}

const STATES = Object.keys(REGS).sort()

export default function RegsScreen({ session }) {
  const [selectedState, setSelectedState] = useState('')
  const [favoriteState, setFavoriteState] = useState(null)

  useEffect(() => {
    const loadFavorite = async () => {
      if (!session) return
      const { data } = await supabase
        .from('profiles').select('home_state').eq('id', session.user.id).single()
      if (data?.home_state) {
        setFavoriteState(data.home_state)
        setSelectedState(data.home_state)
      }
    }
    loadFavorite()
  }, [session])

  const toggleFavorite = async () => {
    if (!selectedState) return
    const newFav = favoriteState === selectedState ? null : selectedState
    setFavoriteState(newFav)
    await supabase.from('profiles').update({ home_state: newFav }).eq('id', session.user.id)
  }

  const reg = REGS[selectedState]

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Guidebook</Text>
      <Text style={styles.subtitle}>Select a state for Rules & Regulations</Text>

      <View style={styles.pickerRow}>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={selectedState}
            onValueChange={v => setSelectedState(v)}
            style={styles.picker}
            dropdownIconColor="#fff"
          >
            <Picker.Item label="Select a state..." value="" color="#555" />
            {favoriteState && <Picker.Item label={`★ ${favoriteState}`} value={favoriteState} color="#f59e0b" />}
            {STATES.filter(s => s !== favoriteState).map(state => (
              <Picker.Item key={state} label={state} value={state} color="#fff" />
            ))}
          </Picker>
        </View>
        {selectedState ? (
          <TouchableOpacity style={styles.favBtn} onPress={toggleFavorite}>
            <Text style={{ fontSize: 20, color: favoriteState === selectedState ? '#f59e0b' : '#555' }}>
              {favoriteState === selectedState ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {reg && (
        <View style={styles.card}>
          <Text style={styles.stateName}>{selectedState}</Text>

          <Text style={styles.sectionLabel}>LICENSING BODY</Text>
          <Text style={styles.agency}>{reg.agency}</Text>

          <Text style={styles.sectionLabel}>OFFICIAL WEBSITE</Text>
          <TouchableOpacity
            style={styles.visitBtn}
            onPress={() => Linking.openURL(reg.link)}
          >
            <Text style={styles.visitBtnText}>Visit Website</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { color: '#fff', fontWeight: '800', fontSize: 22, marginBottom: 6 },
  subtitle: { color: '#555', fontSize: 13, marginBottom: 24 },
  pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  pickerWrap: {
    flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 8,
  },
  picker: { color: '#fff' },
  favBtn: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center',
  },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  stateName: { color: '#fff', fontWeight: '800', fontSize: 18, marginBottom: 20 },
  sectionLabel: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 16 },
  agency: { color: '#fff', fontSize: 14, fontWeight: '600' },
  visitBtn: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8,
  },
  visitBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
})
