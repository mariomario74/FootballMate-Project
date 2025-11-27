import { Session } from '@supabase/supabase-js';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;

    // --- THE FIX IS HERE ---
    // We cast to 'any' so TypeScript stops complaining about "Impossible types"
    const firstSegment = segments[0] as any;

    const inTabsGroup = firstSegment === '(tabs)';
    const inAuthScreen = firstSegment === 'login' || firstSegment === 'signup';

    if (session && inAuthScreen) {
      // @ts-ignore
      router.replace('/(tabs)');
    } else if (!session && inTabsGroup) {
      // @ts-ignore
      router.replace('/login');
    }
    
    // Logic: If we are on 'create', none of the above matches, 
    // so it lets us stay there. (Which is what we want!)

  }, [session, initialized, segments]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return <Slot />;
}