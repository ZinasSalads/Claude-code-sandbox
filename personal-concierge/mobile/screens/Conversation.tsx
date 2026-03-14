import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { API_URL } from '../lib/api';

async function apiPost<T>(path: string, body: any): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const STARTERS = [
  'What should I focus on today?',
  'How am I doing this week?',
  'Plan my weekend',
  'I need motivation',
];

export default function Conversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSending(true);
    scrollToEnd();

    const response = await apiPost<{ message: string }>('/conversation/message', {
      message: text.trim(),
      history: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response?.message || 'I apologize, but I was unable to process that. Please try again.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setSending(false);
    scrollToEnd();
  }, [sending, messages, scrollToEnd]);

  const handleSend = useCallback(() => {
    sendMessage(inputText);
  }, [inputText, sendMessage]);

  const handleStarter = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  const showStarters = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        onContentSizeChange={scrollToEnd}
      >
        {showStarters && (
          <View style={styles.starterContainer}>
            <Text style={styles.starterTitle}>Personal Concierge</Text>
            <Text style={styles.starterSubtitle}>How can I help you today?</Text>
            <View style={styles.starterGrid}>
              {STARTERS.map((s, i) => (
                <TouchableOpacity key={i} style={styles.starterCard} onPress={() => handleStarter(s)}>
                  <Text style={styles.starterText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.assistantText]}>
              {msg.content}
            </Text>
            <Text style={[styles.messageTime, msg.role === 'user' ? styles.userTime : styles.assistantTime]}>
              {msg.timestamp}
            </Text>
          </View>
        ))}

        {sending && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#555577"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  messageList: { flex: 1 },
  messageContent: { padding: 16, paddingBottom: 8 },
  starterContainer: { alignItems: 'center', paddingVertical: 40 },
  starterTitle: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8 },
  starterSubtitle: { fontSize: 15, color: '#8888aa', marginBottom: 28 },
  starterGrid: { width: '100%' },
  starterCard: {
    backgroundColor: '#141420', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 10,
  },
  starterText: { color: '#6C63FF', fontSize: 15, fontWeight: '500', textAlign: 'center' },
  messageBubble: {
    maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 8,
  },
  userBubble: {
    backgroundColor: '#6C63FF', alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#141420', alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  messageText: { fontSize: 15, lineHeight: 21 },
  userText: { color: '#fff' },
  assistantText: { color: '#fff' },
  messageTime: { fontSize: 10, marginTop: 4 },
  userTime: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  assistantTime: { color: '#8888aa' },
  typingText: { color: '#8888aa', fontSize: 14, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0D0D1A',
  },
  textInput: {
    flex: 1, backgroundColor: '#141420', borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, color: '#fff', fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#6C63FF', borderRadius: 20, paddingHorizontal: 20,
    paddingVertical: 10, justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
