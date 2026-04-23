
/**
 * AdminSchoolSettingsPage.jsx — FIXED
 *
 * BUG FIX: "Cannot coerce the result to a single JSON object"
 * .update().select().single() throws PGRST116 when 0 rows matched.
 * Fix: use .select('*') then take data?.[0], and use .maybeSingle() on fetch.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Navigation, Save, Loader2, CheckCircle2,
  Info, Pencil, X, Building2,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

const Skel = ({ className }) => <div className={cn('animate-pulse rounded-2xl bg-white/5', className)} />;

const ConfiguredCard = ({ school, onEdit, t }) => (
  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
    className="glass rounded-2xl p-6 border border-emerald-500/30 bg-emerald-500/5 space-y-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <p className="font-black text-base text-emerald-400">{t('geoActive') || 'Geo-fencing Active'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Teachers must be within <span className="font-bold text-foreground">{school.geo_radius_meters ?? 300} m</span> to sign logbooks.
          </p>
        </div>
      </div>
      <button onClick={onEdit}
        className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-all">
        <Pencil className="h-3.5 w-3.5" /> {t('edit') || 'Edit'}
      </button>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="p-4 rounded-xl bg-white/4 border border-white/8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Latitude</p>
        <p className="font-mono font-bold text-sm">{Number(school.latitude).toFixed(7)}</p>
      </div>
      <div className="p-4 rounded-xl bg-white/4 border border-white/8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Longitude</p>
        <p className="font-mono font-bold text-sm">{Number(school.longitude).toFixed(7)}</p>
      </div>
    </div>
    <div className="p-4 rounded-xl bg-white/4 border border-white/8 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Allowed Radius</p>
      <div className="flex items-center gap-4">
        <p className="font-bold text-sm">{school.geo_radius_meters ?? 300} <span className="text-muted-foreground font-normal">metres</span></p>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
              style={{ width: `${Math.min(100, ((school.geo_radius_meters ?? 300) / 1000) * 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
    {school.name && (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span className="font-semibold text-foreground">{school.name}</span>
      </div>
    )}
  </motion.div>
);

const AdminSchoolSettingsPage = () => {
  const { toast } = useToast();
  const { t }     = useLanguage();
  const schoolId  = localStorage.getItem('schoolId');

  const [school,     setSchool]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [editMode,   setEditMode]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [form, setForm] = useState({ latitude: '', longitude: '', geo_radius_meters: '300' });

  const fetchSchool = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      // ✅ FIXED: .maybeSingle() returns null instead of error when no row found
      const { data, error } = await supabase
        .from('schools').select('*').eq('id', parseInt(schoolId)).maybeSingle();
      if (error) throw error;
      setSchool(data);
      setEditMode(!(data?.latitude && data?.longitude));
      if (data) {
        setForm({
          latitude:          data.latitude?.toString()          || '',
          longitude:         data.longitude?.toString()         || '',
          geo_radius_meters: (data.geo_radius_meters ?? 300).toString(),
        });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSchool(); }, [schoolId]);

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Not supported', description: 'Geolocation is not available in this browser.' });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(p => ({ ...p, latitude: pos.coords.latitude.toFixed(7), longitude: pos.coords.longitude.toFixed(7) }));
        setGeoLoading(false);
        toast({ title: '📍 Location captured', description: 'Coordinates filled. Review and save.' });
      },
      err => { setGeoLoading(false); toast({ variant: 'destructive', title: 'Location denied', description: err.message }); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSave = async () => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const rad = parseInt(form.geo_radius_meters);
    if (isNaN(lat) || isNaN(lng)) {
      toast({ variant: 'destructive', title: 'Invalid coordinates', description: 'Both latitude and longitude are required.' });
      return;
    }
    if (rad < 50) {
      toast({ variant: 'destructive', title: 'Radius too small', description: 'Minimum allowed radius is 50 metres.' });
      return;
    }
    setSaving(true);
    try {
      // Fix: don't rely on returned rows (RLS can block the read-back on update)
      // Just fire the update, then re-fetch to confirm
      const { error } = await supabase
        .from('schools')
        .update({ latitude: lat, longitude: lng, geo_radius_meters: rad })
        .eq('id', parseInt(schoolId));
      if (error) throw error;
      // Re-fetch fresh data
      await fetchSchool();
      setEditMode(false);
      toast({ title: '✅ Settings saved', description: `Geo-fence set to ${rad} m radius.` });
    } catch (e) {
      toast({ variant: 'destructive', title: t('saveFailed') || 'Save failed', description: e.message });
    } finally { setSaving(false); }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('schools')
        .update({ latitude: null, longitude: null, geo_radius_meters: 300 })
        .eq('id', parseInt(schoolId));
      if (error) throw error;
      await fetchSchool();
      setForm({ latitude: '', longitude: '', geo_radius_meters: '300' });
      setEditMode(true);
      toast({ title: 'Geo-fence cleared', description: 'Location enforcement has been disabled.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setSaving(false); }
  };

  const hasCoords = !!(school?.latitude && school?.longitude);

  return (
    <PageTransition>
      <Helmet><title>{t('schoolSettings') || 'School Settings'} — CloudCampus</title></Helmet>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <div className="space-y-1">
          <h1 className="text-2xl font-black flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-indigo-400" />
            </div>
            {t('schoolSettings') || 'School Settings'}
          </h1>
          <p className="text-muted-foreground text-sm pl-14">
            {t('geoDesc') || 'Set GPS coordinates so teachers can only sign logbooks from campus.'}
          </p>
        </div>

        {school?.name && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl glass border border-white/8">
            <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
            <p className="font-bold text-sm">{school.name}</p>
          </motion.div>
        )}

        {loading ? (
          <div className="space-y-4"><Skel className="h-12" /><Skel className="h-48" /></div>
        ) : (
          <AnimatePresence mode="wait">
            {hasCoords && !editMode ? (
              <motion.div key="configured" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                <ConfiguredCard school={school} onEdit={() => setEditMode(true)} t={t} />
                <button onClick={handleClear} disabled={saving}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Disable geo-fencing
                </button>
              </motion.div>
            ) : (
              <motion.div key="edit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="glass rounded-2xl p-6 border border-white/10 space-y-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-indigo-400" />
                    </div>
                    <p className="font-black text-base">{hasCoords ? 'Edit Location' : 'Set Location'}</p>
                  </div>
                  <button onClick={handleGeolocate} disabled={geoLoading}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-white/15 bg-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/25 hover:text-indigo-300 transition-all">
                    {geoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                    {t('useMyLocation') || 'Use my location'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[['Latitude', 'latitude', 'e.g. 3.8661000'], ['Longitude', 'longitude', 'e.g. 11.5154000']].map(([lbl, key, ph]) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">{lbl}</Label>
                      <Input type="number" step="any" placeholder={ph} value={form[key]}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        className="bg-white/5 border-white/10 font-mono" />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Allowed Radius (metres)</Label>
                  <Input type="number" min="50" max="5000" step="50" value={form.geo_radius_meters}
                    onChange={e => setForm(p => ({ ...p, geo_radius_meters: e.target.value }))}
                    className="bg-white/5 border-white/10 max-w-[180px]" />
                  <p className="text-xs text-muted-foreground">Recommended: 100–500 m. Minimum 50 m.</p>
                  {form.geo_radius_meters && (
                    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden max-w-xs mt-2">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (parseInt(form.geo_radius_meters || 0) / 1000) * 100)}%` }}
                        transition={{ duration: 0.4 }} />
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/8 border border-blue-500/15">
                  <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300/80">Leave fields blank to disable enforcement. Teachers outside the radius will be blocked from signing the logbook.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  {hasCoords && (
                    <button onClick={() => setEditMode(false)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                      <X className="h-4 w-4" /> {t('cancel') || 'Cancel'}
                    </button>
                  )}
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white transition-all shadow-lg shadow-indigo-500/25 ml-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {t('saveSettings') || 'Save Settings'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </PageTransition>
  );
};

export default AdminSchoolSettingsPage;
