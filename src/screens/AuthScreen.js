import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [authMode, setAuthMode] = useState('login')

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    setLoading(false)
  }

  const handleSignUp = async () => {
    setLoading(true)
    setMessage('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(error.message)
    } else if (data?.user?.identities?.length === 0) {
      setMessage('An account with that email already exists. Try logging in instead.')
    } else {
      setMessage('Check your email for a confirmation link!')
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>FISHSTAGRAM</Text>
          <Text style={styles.subtitle}>The fishing community</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={authMode === 'login' ? handleLogin : handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>
              {authMode === 'login' ? 'Log In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
          <Text style={styles.switchText}>
            {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.switchBold}>
              {authMode === 'login' ? 'Sign Up' : 'Log In'}
            </Text>
          </Text>
        </TouchableOpacity>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  logo: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: '#666', fontSize: 14, marginTop: 8 },
  input: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 8, padding: 14, color: '#fff', fontSize: 15, marginBottom: 12,
  },
  button: {
    backgroundColor: '#fff', borderRadius: 8, padding: 14,
    alignItems: 'center', marginBottom: 12,
  },
  buttonText: { color: '#000', fontSize: 15, fontWeight: '700' },
  switchText: { color: '#555', textAlign: 'center', fontSize: 14 },
  switchBold: { color: '#fff', fontWeight: '700' },
  message: { color: '#4ade80', textAlign: 'center', marginTop: 16, fontSize: 14 },
})
