import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../supabase';

export default function MatchDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    fetchMatchDetails();
  }, []);

  const fetchMatchDetails = async () => {
    try {
      // 1. Get Match Data
      const { data, error } = await supabase.rpc('get_match_details', { match_id_input: id });
      if (error) throw error;
      
      const matchData = data[0]; 
      setMatch(matchData);

      // 2. Check if I am already in the squad
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user && matchData.current_players && matchData.current_players.includes(user.id)) {
        setHasJoined(true);
      } else {
        setHasJoined(false);
      }

    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Could not load match details.");
    } finally {
      setLoading(false);
    }
  };

  const openMaps = () => {
    if (!match.latitude || !match.longitude) return;
    const label = encodeURIComponent(match.stadium_name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}&ll=${match.latitude},${match.longitude}`,
      android: `geo:0,0?q=${match.latitude},${match.longitude}(${label})`
    });
    Linking.openURL(url);
  };

  const handleJoin = async () => {
    if (!user) return Alert.alert("Error", "Please log in first");
    setLoading(true);
    try {
      const { error } = await supabase.rpc('join_match', { match_id_input: id, user_id_input: user.id });
      if (error) throw error;
      
      setHasJoined(true);
      Alert.alert("Welcome!", "You have joined the squad.");
      
      // Optimistic Update (Update number instantly)
      setMatch(prev => ({
        ...prev,
        current_players: [...(prev.current_players || []), user.id]
      }));
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Handle Leaving
  const handleLeave = async () => {
    Alert.alert("Leave Match", "Are you sure you want to leave the squad?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Leave", 
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const { error } = await supabase.rpc('leave_match', { match_id_input: id, user_id_input: user.id });
            if (error) throw error;

            setHasJoined(false);
            Alert.alert("Left", "You have left the squad.");
            
            // Optimistic Update (Remove ID instantly)
            setMatch(prev => ({
              ...prev,
              current_players: prev.current_players.filter(uid => uid !== user.id)
            }));
          } catch (error) {
            Alert.alert("Error", error.message);
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const formatDate = (isoString) => {
    if (!isoString) return "Date TBD";
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>;
  if (!match) return <View style={styles.center}><Text>Match not found</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <Text style={styles.stadiumName}>{match.stadium_name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{match.status === 'open' ? 'OPEN FOR PLAYERS' : 'FULL'}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.label}>📅 KICKOFF</Text>
            <Text style={styles.value}>{formatDate(match.start_time)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>👥 SQUAD</Text>
            <Text style={styles.value}>
              {match.current_players ? match.current_players.length : 0} / {match.max_players}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${((match.current_players?.length || 0) / match.max_players) * 100}%` }]} />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.mapButton} onPress={openMaps}>
          <Text style={styles.mapBtnText}>📍 Navigate to Pin</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* FOOTER - Changes based on 'hasJoined' */}
      <View style={styles.footer}>
        {hasJoined ? (
          <View style={{gap: 10, width: '100%'}}>
            {/* Main Action: CHAT */}
            <TouchableOpacity style={styles.chatBtn} onPress={() => router.push(`/chat/${id}`)}>
              <Text style={styles.btnText}>💬 Go to Team Chat</Text>
            </TouchableOpacity>

            {/* Secondary Action: LEAVE */}
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
              <Text style={styles.leaveText}>Cancel / Leave Squad</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoin}>
            <Text style={styles.btnText}>Join Match</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, paddingTop: 60, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  closeBtn: { padding: 10, marginRight: 15 },
  closeText: { fontSize: 24, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  scroll: { padding: 20 },
  heroCard: { backgroundColor: '#fff', borderRadius: 20, padding: 25, marginBottom: 20, alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  stadiumName: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10, color: '#000' },
  badge: { backgroundColor: '#e6f7ed', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#00a854', fontWeight: 'bold', fontSize: 12 },
  grid: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  card: { flex: 1, backgroundColor: '#fff', padding: 20, borderRadius: 16, justifyContent: 'center' },
  label: { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 8 },
  value: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  progressBar: { height: 6, backgroundColor: '#eee', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#000' },
  mapButton: { backgroundColor: '#fff', padding: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  mapBtnText: { fontWeight: '700', fontSize: 16 },
  footer: { padding: 25, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', alignItems: 'center' },
  joinBtn: { backgroundColor: '#000', width: '100%', padding: 18, borderRadius: 16, alignItems: 'center' },
  chatBtn: { backgroundColor: '#007AFF', width: '100%', padding: 18, borderRadius: 16, alignItems: 'center' },
  leaveBtn: { backgroundColor: '#ffe5e5', width: '100%', padding: 15, borderRadius: 16, alignItems: 'center', marginTop: 5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  leaveText: { color: 'red', fontWeight: 'bold', fontSize: 14 }
});