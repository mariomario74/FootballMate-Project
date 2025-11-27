import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Bubble, GiftedChat } from 'react-native-gifted-chat';
import { supabase } from '../../supabase';

export default function ChatRoom() {
  const { id } = useLocalSearchParams(); // Match ID
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // 1. Get Current User
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // 2. Load old messages
    fetchMessages();

    // 3. Subscribe to Realtime Updates
    const channel = supabase
      .channel(`room:${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `match_id=eq.${id}` 
      }, async (payload) => {
        // When a new message comes in...
        const newMessage = payload.new;
        
        // Don't duplicate our own message (we added it optimistically)
        if (newMessage.user_id !== user?.id) { 
            
            // Fetch the sender's name quickly
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', newMessage.user_id)
              .single();

            const senderName = profile?.username || 'Unknown Player';

            setMessages((previousMessages) => 
              GiftedChat.append(previousMessages, [{
                _id: newMessage.id,
                text: newMessage.text,
                createdAt: new Date(newMessage.created_at),
                user: {
                  _id: newMessage.user_id,
                  name: senderName, // <--- We now have the name!
                },
              }])
            );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  const fetchMessages = async () => {
    // MAGIC LINE: Fetch message AND the profile username
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(username)')
      .eq('match_id', id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedMessages = data.map(m => ({
        _id: m.id,
        text: m.text,
        createdAt: new Date(m.created_at),
        user: {
          _id: m.user_id,
          // Extract username from the joined table
          name: m.profiles?.username || 'Unknown', 
        },
      }));
      setMessages(formattedMessages);
    }
  };

  const onSend = useCallback(async (messages = []) => {
    const msg = messages[0];
    
    // 1. Show it instantly on screen (Optimistic UI)
    setMessages(previousMessages => GiftedChat.append(previousMessages, messages));

    // 2. Send to Supabase
    const { error } = await supabase.from('messages').insert({
      match_id: id,
      user_id: user.id,
      text: msg.text,
    });

    if (error) console.error("Error sending:", error);
  }, [user, id]);

  const renderBubble = (props) => (
    <View>
      {/* Show Username above the message if it's not me */}
      {props.currentMessage.user._id !== user?.id && (
        <Text style={styles.username}>
          {props.currentMessage.user.name.split('@')[0]}
        </Text>
      )}
      <Bubble
        {...props}
        wrapperStyle={{
          right: { backgroundColor: '#007AFF' }, 
          left: { backgroundColor: '#e5e5ea' }, 
        }}
      />
    </View>
  );

  if (!user) return <ActivityIndicator style={{marginTop: 50}} />;

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        user={{
          _id: user.id, 
        }}
        renderBubble={renderBubble}
        // Shows the name next to the bubble
        renderUsernameOnMessage={true} 
        placeholder="Type a message..."
        alwaysShowSend
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingBottom: 20 },
  username: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
    marginLeft: 10,
  }
});