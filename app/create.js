import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../supabase';

export default function CreateMatch() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('10');
  
  // Date Logic
  const [date, setDate] = useState(new Date());
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState('date'); // 'date' or 'time'

  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name) return Alert.alert("Error", "Please enter a stadium name");
    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in!");

      const lat = parseFloat(params.lat);
      const long = parseFloat(params.long);

      const matchData = {
        stadium_name: name,
        max_players: parseInt(maxPlayers),
        location: `POINT(${long} ${lat})`, 
        host_id: user.id, 
        status: 'open',
        start_time: date.toISOString()
      };

      const { error } = await supabase.from('matches').insert(matchData);
      if (error) throw error;

      router.back(); 

    } catch (err) {
      Alert.alert("Error", err.message);
      setCreating(false);
    }
  };

  const onChange = (event, selectedDate) => {
    // 1. Close picker immediately on Android
    setShow(false);
    
    // 2. Update date only if user clicked "OK"
    if (event.type === 'set' && selectedDate) {
      setDate(selectedDate);
    }
  };

  const showMode = (currentMode) => {
    setShow(true);
    setMode(currentMode);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Host a Match</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Stadium Name</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Wembley Stadium" 
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Max Players</Text>
        <TextInput 
          style={styles.input} 
          value={maxPlayers}
          keyboardType="numeric"
          onChangeText={setMaxPlayers}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Kickoff Schedule</Text>
        
        <View style={styles.row}>
          {/* DATE BUTTON */}
          <TouchableOpacity onPress={() => showMode('date')} style={styles.dateBtn}>
             <Text style={styles.icon}>📅</Text>
             <Text style={styles.dateText}>
               {date.toLocaleDateString()}
             </Text>
          </TouchableOpacity>

          {/* TIME BUTTON */}
          <TouchableOpacity onPress={() => showMode('time')} style={styles.dateBtn}>
             <Text style={styles.icon}>⏰</Text>
             <Text style={styles.dateText}>
               {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </Text>
          </TouchableOpacity>
        </View>

        {/* THE INVISIBLE PICKER (Only appears when requested) */}
        {show && (
          <DateTimePicker
            testID="dateTimePicker"
            value={date}
            mode={mode}
            is24Hour={true}
            display="default"
            onChange={onChange}
          />
        )}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleCreate} disabled={creating}>
        {creating ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Create Match</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancel} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, justifyContent: 'center', backgroundColor: '#f8f9fa' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 30, textAlign: 'center', color: '#1a1a1a' },
  formGroup: { marginBottom: 20 },
  label: { fontWeight: '700', marginBottom: 8, color: '#444' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1e1e1', padding: 15, borderRadius: 12, fontSize: 16 },
  
  // New Styles for the split buttons
  row: { flexDirection: 'row', gap: 10 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e1e1e1', padding: 15, borderRadius: 12 },
  icon: { marginRight: 8, fontSize: 18 },
  dateText: { fontSize: 16, fontWeight: '600' },

  btn: { backgroundColor: '#000', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: "#000", shadowOffset: {width:0, height:4}, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancel: { marginTop: 20, alignItems: 'center' },
  cancelText: { color: '#666', fontWeight: '600' }
});