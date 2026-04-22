/**
 * useYearStatus.js
 * Returns: { yearStatus, loading }
 * yearStatus: null | { status: 'open' | 'closed' | 'suspended', year: {...} }
 *
 * 'suspended' → admin suspended the year temporarily.
 *   All non-admin dashboards see it the same as 'closed' (year-end mode).
 *   Admin sees a special banner but keeps full access.
 *   Can be resumed back to 'open' at any time.
 *
 * 'closed' → permanent end-of-year. Triggers promotion engine. Cannot be reopened.
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
        // 1. Is there a currently active open year?
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

        // 2. Is the current year suspended?
        const { data: suspended } = await supabase
          .from('academic_years')
          .select('*')
          .eq('school_id', parseInt(schoolId))
          .eq('is_current', true)
          .eq('status', 'suspended')
          .maybeSingle();

        if (suspended) {
          setYearStatus({ status: 'suspended', year: suspended });
          return;
        }

        // 3. Is the most recent year closed? (year-end mode)
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

        setYearStatus(null);
      } catch (e) {
        console.error('useYearStatus:', e);
        setYearStatus(null);
      } finally {
        setLoading(false);
      }
    };

    check();

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
