import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { listDaily, type DailyCatalog } from './daily';
import { useBivia } from './store';

export function useDaily() {
  const {session, authReady} = useBivia();
  const owner = session?.user.id ?? 'guest';
  const [state, setState] = useState<{owner:string; data:DailyCatalog|null; error:boolean}>({owner:'',data:null,error:false});
  const request = useRef(0);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState(0);
  const refresh = useCallback(async () => {
    if (!authReady) return;
    const version = ++request.current;
    setLoading(true);
    try {
      const data = await listDaily();
      if (version !== request.current) return;
      setState({owner,data,error:false});
      setExpiresAt(Date.now() + Date.parse(data.nextDayAt)-Date.parse(data.serverNow));
    } catch {
      if (version === request.current) setState({owner,data:null,error:true});
    } finally { if (version === request.current) setLoading(false); }
  }, [owner,authReady]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const app = AppState.addEventListener('change', state => {if(state==='active') void refresh();});
    // Refresh status from other devices while the home screen is visible.
    const poll = setInterval(() => void refresh(), 30000);
    return () => { request.current++; app.remove(); clearInterval(poll); };
  }, [refresh]));
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(() => {setState({owner,data:null,error:false});void refresh();},Math.max(50,expiresAt-Date.now()+100));
    return () => clearTimeout(timer);
  }, [expiresAt,owner,refresh]);
  const matches = state.owner === owner && authReady;
  return {data:matches ? state.data : null, loading:!matches || loading, error:matches && state.error, refresh};
}
