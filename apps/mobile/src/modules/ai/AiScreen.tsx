// Flux AI chat. Tokens arrive as NDJSON (`stream=1` on /step) and paint as they land.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { loadTokens } from '@fluxwp/core';
import { messageText, streamAiStep, useAccount, useApi, useRenderer, type AiChat, type AiEvent, type AiMessage } from '@fluxwp/runtime';
import { Button, EmptyState, IconButton, Spinner, Text } from '@/ui/primitives';
import { useScreenTitle } from '../kit';

interface ChatList { chats: { id: number; title: string; status: string }[] }
interface SendResult { state: string; chat: AiChat }

export default function AiScreen(_props: { params: Record<string, string> }) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  useScreenTitle(t('mobile.screens.ai.title'));
  const api = useApi();
  const account = useAccount();
  const renderer = useRenderer();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['flxai', account.id, 'chats'], queryFn: () => api<ChatList>('flx-ai/v1/chats') });
  const [openId, setOpenId] = useState<number | null>(null);
  const [chat, setChat] = useState<AiChat | null>(null);
  const [draft, setDraft] = useState('');
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);

  const load = async (id: number) => {
    setOpenId(id);
    setChat(await api<AiChat>(`flx-ai/v1/chats/${id}`));
    setDraft('');
  };

  const consume = (ev: AiEvent) => {
    if (ev.t === 'text') setDraft((d) => d + (ev.d ?? ''));
    if ((ev.t === 'result' || ev.t === 'chat') && ev.chat) {
      setChat(ev.chat);
      setDraft('');
      setOpenId(ev.chat.id);
    }
  };

  const step = async (id: number) => {
    setStreaming(true);
    try {
      const tokens = account.authKind === 'demo' ? null : await loadTokens(account.id);
      await streamAiStep({
        siteUrl: account.siteUrl,
        demo: account.authKind === 'demo',
        token: tokens?.access,
        scheme: account.authKind === 'apppass' ? 'basic' : 'bearer',
        chatId: id,
      }, consume);
    } finally {
      setStreaming(false);
    }
  };

  const send = useMutation({
    mutationFn: async (body: string) => {
      const id = openId ?? 0;
      return api<SendResult>(`flx-ai/v1/chats/${id}/send`, { method: 'POST', body: { text: body } });
    },
    onSuccess: async (r) => {
      setChat(r.chat);
      setOpenId(r.chat.id);
      setText('');
      void qc.invalidateQueries({ queryKey: ['flxai', account.id, 'chats'] });
      if (r.state === 'continue' || r.chat.status === 'running') await step(r.chat.id);
    },
    onError: (e) => renderer.ui.toast(e instanceof Error ? e.message : String(e), 'error'),
  });

  const decide = async (ok: boolean) => {
    if (!chat) return;
    const decisions = Object.fromEntries(chat.pending.map((p) => [p.id, ok ? 'approve' : 'reject']));
    const r = await api<SendResult>(`flx-ai/v1/chats/${chat.id}/decide`, { method: 'POST', body: { decisions } });
    setChat(r.chat);
    if (r.state === 'continue' || r.chat.status === 'running') await step(chat.id);
  };

  const messages: (AiMessage & { id: string })[] = [
    ...(chat?.messages ?? []).filter((m) => messageText(m)).map((m, i) => ({ ...m, id: 'm' + i })),
    ...(draft ? [{ id: 'draft', role: 'assistant', content: draft }] : []),
  ];

  if (openId === null) {
    return (
      <View testID="screen-ai" style={styles.fill}>
        <View style={styles.tools}>
          <Button icon="plus" label={t('mobile.screens.ai.new')} onPress={() => (setOpenId(0), setChat(null))} />
        </View>
        {list.isPending ? <Spinner /> : (
          <FlashList
            data={list.data?.chats ?? []}
            keyExtractor={(c) => String(c.id)}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" onPress={() => void load(item.id)} style={styles.row}>
                <Text numberOfLines={1}>{item.title || t('mobile.screens.ai.new')}</Text>
                <Text variant="caption">{item.status}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<EmptyState icon="ai" title={t('mobile.screens.ai.empty')} body={t('mobile.screens.ai.emptyBody')} action={{ label: t('mobile.screens.ai.new'), onPress: () => (setOpenId(0), setChat(null)) }} />}
          />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView testID="screen-ai" style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.head}>
        <IconButton icon="back" label={t('mobile.shell.back')} onPress={() => (setOpenId(null), setChat(null), void list.refetch())} />
        <Text variant="label" numberOfLines={1} style={styles.flex}>{chat?.title || t('mobile.screens.ai.new')}</Text>
      </View>
      <FlashList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text variant="caption" tone="muted">{mine ? t('mobile.screens.ai.you') : t('mobile.screens.ai.assistant')}</Text>
              <Text>{messageText(item)}</Text>
            </View>
          );
        }}
        ListEmptyComponent={streaming ? <Spinner label={t('mobile.screens.ai.thinking')} /> : null}
        contentContainerStyle={styles.thread}
      />
      {chat?.pending?.length ? (
        <View style={styles.pending}>
          <Text variant="label">{t('mobile.screens.ai.tool')}</Text>
          {chat.pending.map((p) => <Text key={p.id} variant="small">{p.title || p.name}</Text>)}
          <View style={styles.actions}>
            <Button kind="secondary" label={t('mobile.screens.ai.deny')} onPress={() => void decide(false)} />
            <Button label={t('mobile.screens.ai.approve')} onPress={() => void decide(true)} />
          </View>
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput value={text} onChangeText={setText} placeholder={t('mobile.screens.ai.placeholder')} placeholderTextColor={theme.colors.textMuted} style={styles.input} accessibilityLabel={t('mobile.screens.ai.placeholder')} />
        <IconButton icon="airplane" label={t('mobile.screens.ai.send')} color={theme.colors.primary} onPress={() => text.trim() && send.mutate(text.trim())} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  fill: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  tools: { padding: theme.space[3] },
  row: { minHeight: 64, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: theme.space[4], justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg },
  head: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  thread: { padding: theme.space[3] },
  bubble: { maxWidth: '86%', borderRadius: theme.radius.lg, padding: 12, marginBottom: 8, gap: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: theme.colors.primarySoft },
  theirs: { alignSelf: 'flex-start', backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  pending: { margin: theme.space[3], padding: theme.space[3], gap: 6, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
  actions: { flexDirection: 'row', gap: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, padding: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  input: { flex: 1, minHeight: 44, maxHeight: 120, color: theme.colors.text, fontSize: 16, fontFamily: theme.font.family, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.bg },
}));
