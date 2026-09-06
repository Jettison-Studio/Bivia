import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Button, Card, Heading, Notice, T, c, font } from './ui';
import type { Mode } from '@bivia/core';
type SavedRound = {id:string; quiz_id:string; mode:Mode; rank_day:string; score:number; quizzes:{title:string}|null};
export function DailyHistory({userId}:{userId:string}) {
  const [rounds,setRounds] = useState<SavedRound[]>([]);
  const [error,setError] = useState(false);
  const [loading,setLoading] = useState(true);
  const [version,setVersion] = useState(0);
  useFocusEffect(useCallback(() => {
    let active=true;
    setError(false);
    setLoading(true);
    setRounds([]);
    if (!supabase) {setError(true);setLoading(false);return;}
    const client = supabase;
    void (async () => {
      for (let retry=0;retry<3;retry++) {
        const {data,error} = await client.from('attempts').select('id,quiz_id,mode,rank_day,score,quizzes(title)')
          .eq('user_id',userId).eq('ranked',true).eq('status','completed')
          .order('completed_at',{ascending:false}).limit(20);
        if (!active) return;
        // Local auth/database clocks can briefly disagree immediately after signup.
        if (error?.message.includes('JWT issued at future') && retry<2) {
          await new Promise(resolve=>setTimeout(resolve,1000));
          if (!active) return;
          continue;
        }
        setError(!!error);setRounds((data ?? []) as unknown as SavedRound[]);setLoading(false);return;
      }
    })();
    return () => {active=false;};
  },[userId,version]));
  return <View style={{marginTop:32,gap:12}}>
    <Heading title="Your daily rounds" />
    {loading ? <T style={{color:c.muted}}>Loading your rounds…</T> : error ? <><Notice>We couldn’t load your saved rounds.</Notice><Button variant="secondary" onPress={()=>setVersion(v=>v+1)}>Retry loading results</Button></> : rounds.length ? rounds.map(round =>
      <Card key={round.id} style={{gap:8}}>
        <T style={{fontFamily:font.semibold}}>{round.quizzes?.title ?? 'Daily trivia'}</T>
        <T style={{color:c.muted,fontSize:13}}>{round.rank_day} · {round.mode === 'category' ? 'Regular' : round.mode === 'timed' ? 'Timed' : 'Challenger'} · {round.score} pts</T>
        <Button variant="ghost" onPress={()=>router.push({pathname:'/quiz/[id]',params:{id:round.quiz_id,mode:round.mode,attempt:round.id,view:'results'}})}>View results</Button>
      </Card>
    ) : <T style={{color:c.muted}}>Your first daily round is waiting.</T>}
  </View>;
}
