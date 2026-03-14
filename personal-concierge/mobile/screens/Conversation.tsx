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
import { colors, spacing, radii, font, shadow } from '../theme';

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
          placeholderTextColor={colors.textTertiary}
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
  container: { flex: 1, backgroundColor: colors.bg },
  messageList: { flex: 1 },
  messageContent: { padding: spacing.lg, paddingBottom: spacing.sm },
  starterContainer: { alignItems: 'center', paddingVertical: spacing['5xl'] - 8 },
  starterTitle: { fontSize: font['3xl'] - 6, fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  starterSubtitle: { fontSize: font.md, color: colors.textSecondary, marginBottom: spacing['3xl'] - 4 },
  starterGrid: { width: '100%' },
  starterCard: {
    backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md - 2,
    ...shadow.card,
  },
  starterText: { color: colors.textAccent, fontSize: font.md, fontWeight: font.medium, textAlign: 'center' },
  messageBubble: {
    maxWidth: '80%', borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  userBubble: {
    backgroundColor: colors.primary, alignSelf: 'flex-end',
    borderBottomRightRadius: spacing.xs,
  },
  assistantBubble: {
    backgroundColor: colors.bgCard, alignSelf: 'flex-start',
    borderBottomLeftRadius: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  messageText: { fontSize: font.md, lineHeight: 21 },
  userText: { color: colors.white },
  assistantText: { color: colors.textPrimary },
  messageTime: { fontSize: 10, marginTop: spacing.xs },
  userTime: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  assistantTime: { color: colors.textTertiary },
  typingText: { color: colors.textSecondary, fontSize: font.sm + 1, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  textInput: {
    flex: 1, backgroundColor: colors.bgInput, borderRadius: radii.full, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2, color: colors.textPrimary, fontSize: font.md, maxHeight: 100,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  sendBtn: {
    backgroundColor: colors.primary, borderRadius: radii.full, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md - 2, justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: colors.white, fontWeight: font.semibold, fontSize: font.md },
});
