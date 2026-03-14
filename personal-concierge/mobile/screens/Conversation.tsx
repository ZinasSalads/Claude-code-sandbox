import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  { text: 'What should I focus on today?', icon: '🎯' },
  { text: 'How am I doing this week?', icon: '📊' },
  { text: 'Plan my weekend', icon: '📅' },
  { text: 'I need motivation', icon: '💪' },
  { text: 'Review my supplements', icon: '💊' },
  { text: 'Analyze my sleep', icon: '😴' },
];

// Animated typing dots
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </View>
    </View>
  );
}

export default function Conversation() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

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
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>AI</Text>
            </View>
            <Text style={styles.starterTitle}>Personal Concierge</Text>
            <Text style={styles.starterSubtitle}>
              Ask me anything about your health, fitness, schedule, or goals.
            </Text>
            <View style={styles.starterGrid}>
              {STARTERS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.starterCard}
                  onPress={() => sendMessage(s.text)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.starterIcon}>{s.icon}</Text>
                  <Text style={styles.starterText}>{s.text}</Text>
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

        {sending && <TypingIndicator />}
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask your concierge..."
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
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  messageList: { flex: 1 },
  messageContent: { padding: spacing.lg, paddingBottom: spacing.sm },
  // Empty state
  starterContainer: { alignItems: 'center', paddingTop: spacing['4xl'] },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.primaryBorder,
  },
  logoText: { color: colors.primary, fontSize: font.xl, fontWeight: font.bold },
  starterTitle: {
    fontSize: font['2xl'], fontWeight: font.bold, color: colors.textPrimary, marginBottom: spacing.sm,
  },
  starterSubtitle: {
    fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing['3xl'],
    textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing['2xl'],
  },
  starterGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  starterCard: {
    width: '48%',
    backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  starterIcon: { fontSize: 20, marginBottom: spacing.sm },
  starterText: { color: colors.textPrimary, fontSize: font.sm, fontWeight: font.medium, lineHeight: 18 },
  // Messages
  messageBubble: {
    maxWidth: '82%', borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm,
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
  messageText: { fontSize: font.md, lineHeight: 22 },
  userText: { color: colors.white },
  assistantText: { color: colors.textPrimary },
  messageTime: { fontSize: 10, marginTop: spacing.xs },
  userTime: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  assistantTime: { color: colors.textTertiary },
  // Typing indicator
  typingBubble: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
  // Input bar
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
    backgroundColor: colors.primary, borderRadius: radii.full,
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendIcon: { color: colors.white, fontWeight: font.bold, fontSize: font.lg },
});
