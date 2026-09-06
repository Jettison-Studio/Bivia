import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon, T, font } from './ui';
import { supabase } from '../lib/supabase';

export function VersePreview({ visible, verse, reference, seconds, reading = false, onReady, busy = false, error, onExit }: { visible: boolean; verse: string; reference: string; seconds: number; reading?: boolean; onReady?: () => void; busy?: boolean; error?: string; onExit?: () => void }) {
  const passageReference = reference.split(' · ')[0];
  const useNiv = reference.includes('NIV') || reference.includes('Original clue');
  const [passage, setPassage] = useState<{key: string; text: string; reference: string; copyright: string; contextUrl: string} | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!visible || !useNiv) return;
    let active = true;
    setLoading(true); setLoadError('');
    async function load() {
      try {
        if (!supabase) throw new Error('Scripture is not connected.');
        const {data, error} = await supabase.functions.invoke('bible-passage', {body: {reference: passageReference}});
        if (error || !data?.text) throw new Error('Couldn’t load the full passage.');
        if (active) setPassage({...data, key: passageReference});
      } catch { if (active) setLoadError('Couldn’t load your NIV passage. Please retry.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => {active = false;};
  }, [visible, useNiv, passageReference, retry]);
  const fullPassage = passage?.key === passageReference ? passage : null;
  const displayText = fullPassage?.text ?? (useNiv ? '' : verse);
  const original = !useNiv && reference.includes('Original clue');
  return <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onExit ?? (() => {})}>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#10091d' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 26 }}>
        <Icon name="book-outline" color="#d0b3ff" size={32} />
        <T style={{ color: '#d0b3ff', fontSize: 12, letterSpacing: 2 }}>{original ? 'YOUR CLUE' : 'YOUR BIBLE VERSE'}</T>
        <T style={{ maxWidth: 680, fontSize: 28, lineHeight: 42, fontFamily: font.medium, color: 'white', textAlign: 'center' }}>{displayText ? (original ? displayText : `“${displayText}”`) : (loadError ? 'Let’s try that again.' : 'Your Scripture is loading…')}</T>
        <T style={{ color: '#d0b3ff', textAlign: 'center' }}>{fullPassage ? `${fullPassage.reference} · NIV` : reference}</T>
        {reading ? <View style={{ gap: 16, width: '100%', maxWidth: 360 }}>
          {loading && <ActivityIndicator color="white" accessibilityLabel="Loading full Scripture" />}
          {!!loadError && <><T style={{color: '#ffd9e8', textAlign: 'center'}}>{loadError}</T><Button variant="white" onPress={() => setRetry(n => n + 1)}>Retry passage</Button>{onExit && <Button variant="white" onPress={onExit}>Leave round</Button>}</>}
          {!!error && <T style={{ color: '#ffd9e8', textAlign: 'center' }}>{error}</T>}
          <Button variant="white" onPress={onReady ?? (() => {})} disabled={busy || !onReady || (useNiv && !fullPassage)}>{busy ? 'Opening…' : 'I’m ready'}</Button>
        </View> : <View style={{ marginTop: 24 }}><T accessibilityLiveRegion="polite" style={{ color: 'white', fontFamily: font.bold, fontSize: 56, lineHeight: 68 }}>{Math.max(1, Math.min(3, seconds))}</T></View>}
        {fullPassage && <T style={{ color: '#b9aacb', fontSize: 11, lineHeight: 17, textAlign: 'center', maxWidth: 600 }}>Scripture provided by YouVersion{'\n'}{fullPassage.copyright}</T>}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
