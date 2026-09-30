import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Switch,
  ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Image,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { recordDpdpConsents, DPDP_POLICY_VERSION } from '../lib/dpdp';
import { Colors, BLOOD_GROUPS, APP_TAGLINE } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import { recordPrivacyConsent } from '../lib/consent';
import ExpiryDateField from '../components/ExpiryDateField';
import { INDIA_STATES, filterCities, filterStates } from '../constants/geoIndia';

export default function LoginScreen(props?: { onSuccess?: () => void }) {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'otp'>('signin');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // signup
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState('TG');
  const [stateQuery, setStateQuery] = useState('Telangana');
  const [showStateList, setShowStateList] = useState(false);
  const [city, setCity] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [showCityList, setShowCityList] = useState(false);

  const stateSuggestions = useMemo(() => filterStates(stateQuery), [stateQuery]);
  const citySuggestions = useMemo(() => filterCities(stateCode, city), [stateCode, city]);

  const sendOtp = async () => {
    if (!phone.trim()) { Alert.alert('Phone required'); return; }
    setLoading(true);
    try {
      const e164 = phone.trim().startsWith('+') ? phone.trim() : `+91${phone.trim().replace(/^0/, '')}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (error) throw error;
      setOtpSent(true);
      Alert.alert('OTP sent', 'Enter the SMS code. Phone auth must be enabled in Supabase.');
    } catch (e: any) {
      Alert.alert('OTP', e.message || 'Enable Phone provider in Supabase Auth.');
    } finally { try { if (privacyAccepted) await recordDpdpConsents({ privacyAccepted: true }); } catch (e) { console.log(e); }
      setLoading(false); }
  };

  const verifyOtp = async () => {
    if (!agreed) { Alert.alert('Consent required'); return; }
    setLoading(true);
    try {
      const e164 = phone.trim().startsWith('+') ? phone.trim() : `+91${phone.trim().replace(/^0/, '')}`;
      const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp.trim(), type: 'sms' });
      if (error) throw error;
      await recordPrivacyConsent().catch(() => {});
      props?.onSuccess?.();
    } catch (e: any) {
      Alert.alert('OTP', e.message);
    } finally { setLoading(false); }
  };

  const submit = async () => {
    try {
      if (!agreed) {
        Alert.alert('Consent required', 'Accept Privacy Policy to continue.');
        setShowPrivacy(true);
        return;
      }
      if (mode === 'otp') return;
      if (!email.trim() || !password) {
        Alert.alert('Enter email and password');
        return;
      }
      if (mode === 'signup') {
        if (!fullName.trim() || !phone.trim() || !dob || !city.trim() || !stateCode || !bloodGroup) {
          Alert.alert('Required', 'Name, phone, DOB, blood group, state and city are mandatory.');
          return;
        }
      }
      setLoading(true);
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              date_of_birth: dob,
              state_code: stateCode,
              area: city.trim(),
              blood_group: bloodGroup,
            },
          },
        });
        if (error) throw error;
        if (data.user) {
          try {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              email: email.trim().toLowerCase(),
              full_name: fullName.trim(),
              phone: phone.trim(),
              date_of_birth: dob,
              state_code: stateCode,
              area: city.trim(),
              blood_group: bloodGroup,
            });
          } catch (pe) {
            console.log('profile upsert', pe);
          }
        }
        try { await recordPrivacyConsent(); } catch (ce) { console.log(ce); }
        Alert.alert('Account created', 'Confirm email if required, then sign in.');
        setMode('signin');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        const uid = data.user?.id;
        if (uid) {
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('deleted_at')
              .eq('id', uid)
              .maybeSingle();
            if (prof?.deleted_at) {
              await supabase.auth.signOut();
              Alert.alert('Account closed', 'This account was deleted.');
              return;
            }
          } catch (pe) {
            console.log('profile check', pe);
          }
        }
        try { await recordPrivacyConsent(); } catch (ce) { console.log(ce); }
        try { props?.onSuccess?.(); } catch {}
        // Session is applied by App.tsx onAuthStateChange — do not navigate manually
      }
    } catch (e: any) {
      console.log('auth submit', e);
      Alert.alert('Sign in', e?.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  };

  if (showPrivacy) {
    return (
      <PrivacyPolicyScreen
        requireAccept
        onAccept={() => { setAgreed(true); setShowPrivacy(false); }}
        onClose={() => setShowPrivacy(false)}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background, paddingTop: Math.max(insets.top, 8) }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image source={require('../assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
          <Text style={styles.brand}>Bharosa</Text>
          <Text style={styles.tag}>{APP_TAGLINE}</Text>

          {mode === 'signup' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Create account</Text>

              <Text style={styles.label}>Full name *</Text>
              <TextInput style={styles.input} placeholder="As on ID" value={fullName} onChangeText={setFullName} placeholderTextColor={Colors.muted} />

              <Text style={styles.label}>Phone *</Text>
              <TextInput style={styles.input} placeholder="10-digit mobile" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={Colors.muted} />

              <ExpiryDateField value={dob} onChange={setDob} label="Date of birth *" />

              <Text style={styles.label}>Blood group *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                {BLOOD_GROUPS.map((g) => (
                  <TouchableOpacity key={g} onPress={() => setBloodGroup(g)} style={[styles.chip, bloodGroup === g && styles.chipOn]}>
                    <Text style={{ color: bloodGroup === g ? '#fff' : Colors.ink, fontSize: 13 }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>State *</Text>
              <TextInput
                style={styles.input}
                placeholder="Type or pick state"
                value={stateQuery}
                onChangeText={(t) => {
                  setStateQuery(t);
                  setShowStateList(true);
                  setShowCityList(false);
                }}
                onFocus={() => { setShowStateList(true); setShowCityList(false); }}
                placeholderTextColor={Colors.muted}
              />
              {showStateList ? (
                <View style={styles.suggestBox}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }}>
                    {stateSuggestions.map((s) => (
                      <TouchableOpacity
                        key={s.code}
                        style={styles.suggestRow}
                        onPress={() => {
                          setStateCode(s.code);
                          setStateQuery(s.name);
                          setShowStateList(false);
                          setCity('');
                          setShowCityList(false);
                        }}
                      >
                        <Text style={styles.suggestText}>{s.name}</Text>
                        <Text style={styles.suggestCode}>{s.code}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <Text style={styles.label}>City / area *</Text>
              <TextInput
                style={styles.input}
                placeholder={stateCode ? 'Type city name' : 'Select state first'}
                value={city}
                onChangeText={(t) => {
                  setCity(t);
                  setShowCityList(true);
                  setShowStateList(false);
                }}
                onFocus={() => {
                  setShowCityList(true);
                  setShowStateList(false);
                }}
                placeholderTextColor={Colors.muted}
              />
              {showCityList && citySuggestions.length > 0 ? (
                <View style={styles.suggestBox}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }}>
                    {citySuggestions.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={styles.suggestRow}
                        onPress={() => {
                          setCity(c);
                          setShowCityList(false);
                          Keyboard.dismiss();
                        }}
                      >
                        <Text style={styles.suggestText}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              {stateCode && citySuggestions.length === 0 && city.length > 0 ? (
                <Text style={styles.hint}>No match — you can still type your city and continue.</Text>
              ) : null}
            </View>
          ) : null}

          {mode !== 'otp' ? (
            <>
              <Text style={styles.label}>Email *</Text>
              <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholderTextColor={Colors.muted} />
              <Text style={styles.label}>Password *</Text>
              <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor={Colors.muted} />
            </>
          ) : (
            <>
              <Text style={styles.label}>Phone *</Text>
              <TextInput style={styles.input} placeholder="+91..." value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={Colors.muted} />
              {otpSent ? (
                <>
                  <Text style={styles.label}>OTP</Text>
                  <TextInput style={styles.input} placeholder="6-digit code" value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholderTextColor={Colors.muted} />
                </>
              ) : null}
            </>
          )}

          <View style={styles.consentRow}>
            <Switch value={agreed} onValueChange={setAgreed} trackColor={{ true: Colors.gold }} />
            <Text style={styles.consentText}>
              I accept the <Text style={styles.link} onPress={() => setShowPrivacy(true)}>Privacy Policy</Text> *
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.btn, !agreed && { opacity: 0.5 }]}
            onPress={mode === 'otp' ? (otpSent ? verifyOtp : sendOtp) : submit}
            disabled={loading || !agreed}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnText}>
                {mode === 'otp' ? (otpSent ? 'Verify OTP' : 'Send OTP') : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setShowStateList(false);
              setShowCityList(false);
              setMode(mode === 'signin' ? 'signup' : mode === 'signup' ? 'otp' : 'signin');
            }}
          >
            <Text style={styles.switchMode}>
              {mode === 'signin' ? 'New here? Create account' : mode === 'signup' ? 'Prefer phone OTP?' : 'Have an account? Email sign in'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: 20, paddingTop: 36, paddingBottom: 48 },
  logo: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  logoMark: { fontSize: 32, fontWeight: '900', color: '#1A2744' },
  brand: { fontSize: 28, fontWeight: '800', color: Colors.ink, textAlign: 'center', marginTop: 12 },
  tag: { color: Colors.muted, textAlign: 'center', marginBottom: 18, marginTop: 4 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontWeight: '800', fontSize: 16, color: Colors.ink, marginBottom: 8 },
  label: { fontSize: 12, color: Colors.muted, marginBottom: 4, marginTop: 8, fontWeight: '600' },
  input: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, height: 48, paddingHorizontal: 14, color: Colors.ink,
  },
  suggestBox: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginTop: 6,
    backgroundColor: '#fff', overflow: 'hidden',
  },
  suggestRow: {
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  suggestText: { color: Colors.ink, fontWeight: '600' },
  suggestCode: { color: Colors.muted, fontSize: 12 },
  hint: { color: Colors.muted, fontSize: 11, marginTop: 6 },
  consentRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 10 },
  consentText: { flex: 1, color: Colors.ink, fontSize: 13 },
  link: { color: Colors.gold, fontWeight: '700' },
  btn: {
    backgroundColor: Colors.gold, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  switchMode: { textAlign: 'center', color: Colors.ink, marginTop: 16, fontWeight: '600' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, marginRight: 8, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  logoImg: { width: 140, height: 140, alignSelf: 'center', marginBottom: 4 },
});
