/**
 * useYearStatus.js
 * Shared hook — detects current academic year state for any dashboard.
 * Returns: { yearStatus, loading }
 * yearStatus: null | { status: 'open'|'closed', year: {...} }
 *
 * Usage:
 *   const { yearStatus, loading } = useYearStatus();
 *   if (yearStatus?.status === 'closed') → show year-end page
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export function useYearStatus() {
  const schoolId = localStorage.getItem('schoolId');
  const [yearStatus, setYearStatus] = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }

    const check = async () => {
      setLoading(true);
      try {
        // First: is there a currently active open year?
        const { data: open } = await supabase
          .from('academic_years')
          .select('*')
          .eq('school_id', parseInt(schoolId))
          .eq('is_current', true)
          .eq('status', 'open')
          .maybeSingle();

        if (open) {
          setYearStatus({ status: 'open', year: open });
          return;
        }

        // Second: is the most recent year closed? (year-end mode)
        const { data: closed } = await supabase
          .from('academic_years')
          .select('*')
          .eq('school_id', parseInt(schoolId))
          .eq('status', 'closed')
          .order('end_date', { ascending: false })
          .limit(1);

        if (closed?.length > 0) {
          setYearStatus({ status: 'closed', year: closed[0] });
          return;
        }

        // No year at all yet
        setYearStatus(null);
      } catch (e) {
        console.error('useYearStatus:', e);
        setYearStatus(null);
      } finally {
        setLoading(false);
      }
    };

    check();

    // Realtime: re-check when academic_years table changes
    const ch = supabase
      .channel(`year_status_${schoolId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'academic_years',
        filter: `school_id=eq.${parseInt(schoolId)}`,
      }, check)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [schoolId]);

  return { yearStatus, loading };
}
