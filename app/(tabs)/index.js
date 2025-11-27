import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../supabase';

// --- OPTIMIZATION 1: MEMOIZED MARKER ---
// We define this OUTSIDE the main component so it doesn't re-render constantly.
// This makes the map 10x smoother.
const MatchMarker = React.memo(({ match, isSelected, onPress }) => {
  return (
    <Marker
      coordinate={{ latitude: match.latitude, longitude: match.longitude }}
      pinColor={isSelected ? "blue" : "red"}
      onPress={(e) => {
        e.stopPropagation();
        onPress(match);
      }}
    />
  );
}, (prev, next) => {
  // Only re-render if selection state changes or location moves (rare)
  return prev.isSelected === next.isSelected && 
         prev.match.latitude === next.match.latitude &&
         prev.match.longitude === next.match.longitude;
});

export default function Index() {
  const router = useRouter();
  const [location, setLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(null); 
  const [isSelecting, setIsSelecting] = useState(false); 
  const [matches, setMatches] = useState([]);
  
  // Only show full-screen loader on FIRST load
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);

  // 1. Initial Setup
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need location access to find matches.');
        setLoading(false);
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);
      setMapCenter(currentLocation.coords);
      
      // Initial fetch
      fetchMatches(currentLocation.coords.latitude, currentLocation.coords.longitude);
    })();
  }, []);

  // 2. OPTIMIZATION 2: Smooth Refresh
  useFocusEffect(
    useCallback(() => {
      if (!location) return;
      
      // Wait 500ms for the navigation animation to finish before doing heavy work
      const timer = setTimeout(() => {
        setIsSelecting(false); 
        setSelectedMatch(null); 
        // Fetch new data silently
        fetchMatches(location.latitude, location.longitude);
      }, 500);

      return () => clearTimeout(timer);
    }, [location])
  );

  const fetchMatches = async (lat, long) => {
    try {
      // OPTIMIZATION 3: Smaller Radius (15km instead of 50km) for speed
      let { data, error } = await supabase.rpc('get_nearby_matches', {
        lat: lat, long: long, radius_meters: 15000 
      });
      if (error) console.error("Supabase Error:", error);
      else setMatches(data || []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="blue" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Log Out</Text>
      </TouchableOpacity>

      {location ? (
        <View style={{flex: 1}}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            showsUserLocation={true}
            onRegionChangeComplete={(region) => setMapCenter(region)}
            onPress={() => setSelectedMatch(null)} 
          >
            {/* Render the Optimized Markers */}
            {matches.map((match) => (
              <MatchMarker 
                key={match.id}
                match={match}
                isSelected={selectedMatch?.id === match.id}
                onPress={setSelectedMatch}
              />
            ))}
          </MapView>

          {isSelecting && (
            <View style={styles.centerMarkerContainer} pointerEvents="none">
              <Text style={{fontSize: 40}}>📍</Text>
            </View>
          )}
        </View>
      ) : (
        <Text>Waiting for GPS...</Text>
      )}

      {selectedMatch && !isSelecting && (
        <View style={styles.matchCardContainer}>
          <View style={styles.matchCard}>
            <View style={styles.cardHeader}>
               <Text style={styles.cardTitle}>{selectedMatch.stadium_name}</Text>
               <TouchableOpacity onPress={() => setSelectedMatch(null)}>
                 <Text style={styles.closeCard}>✕</Text>
               </TouchableOpacity>
            </View>

            <View style={styles.cardStats}>
               <Text style={styles.cardText}>
                 👥 {selectedMatch.current_players ? selectedMatch.current_players.length : 0} / {selectedMatch.max_players} Players
               </Text>
               <Text style={[
                 styles.cardStatus, 
                 { color: (selectedMatch.current_players?.length || 0) >= selectedMatch.max_players ? 'red' : 'green' }
               ]}>
                 {(selectedMatch.current_players?.length || 0) >= selectedMatch.max_players ? 'FULL' : 'OPEN'}
               </Text>
            </View>

            <TouchableOpacity 
              style={styles.viewDetailsBtn} 
              onPress={() => router.push(`/match/${selectedMatch.id}`)}
            >
              <Text style={styles.viewDetailsText}>View Details & Join</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {!selectedMatch && (
        <View style={styles.overlay}>
          <TouchableOpacity 
            style={[styles.button, isSelecting ? styles.confirmBtn : styles.hostBtn]}
            activeOpacity={0.7}
            onPress={() => {
              if (!isSelecting) {
                setIsSelecting(true);
              } else {
                if (mapCenter) {
                  router.push({
                    pathname: "/create",
                    params: { lat: mapCenter.latitude, long: mapCenter.longitude }
                  });
                } else {
                  Alert.alert("Wait", "Map is not ready yet...");
                }
              }
            }}
          >
              <Text style={styles.buttonText}>
                {isSelecting ? "Confirm Location" : "+ Host Match"}
              </Text>
          </TouchableOpacity>

          {isSelecting && (
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => setIsSelecting(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  overlay: { position: 'absolute', bottom: 50, zIndex: 100, elevation: 10, alignItems: 'center', width: '100%' },
  button: { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, width: 200, alignItems: 'center' },
  hostBtn: { backgroundColor: '#000' },
  confirmBtn: { backgroundColor: 'green' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  signOutBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'white', padding: 8, borderRadius: 8 },
  signOutText: { color: 'red', fontWeight: 'bold' },
  centerMarkerContainer: { position: 'absolute', top: '50%', left: '50%', marginTop: -35, marginLeft: -11, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { marginTop: 15, backgroundColor: 'white', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, elevation: 5 },
  cancelText: { color: 'red', fontWeight: 'bold' },
  matchCardContainer: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center', zIndex: 200 },
  matchCard: { width: '90%', backgroundColor: 'white', borderRadius: 20, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  closeCard: { fontSize: 20, color: '#999', padding: 5 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  cardText: { fontSize: 14, color: '#666', fontWeight: '600' },
  cardStatus: { fontSize: 14, fontWeight: 'bold' },
  viewDetailsBtn: { backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  viewDetailsText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});