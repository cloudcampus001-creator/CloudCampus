/**
 * AdminSchoolSettingsPage.jsx
 *
 * ROOT CAUSE FIX:
 *  Supabase does NOT error when .update().eq() matches 0 rows — it just
 *  returns null data silently. Previous code set state from form values
 *  after save, so the UI showed "configured" even though nothing was
 *  written to the DB. On refresh the fetch returned null coordinates and
 *  went back to "not configured".
 *
 *  Fix: the update now uses .select().single() — if 0 rows matched,
 *  Supabase returns an error ("JSON object requested, multiple (or no)
 *  rows returned"), which we catch and surface. State is always set from
 *  the actual row returned by Supabase, never from form values.
 *
 * Two display modes:
 *  CONFIGURED  — DB row has lat+lng → green card, persists across refreshes
 *  EDIT        — no coords yet OR admin clicked Edit → form
 *
 * SQL migration (run once in Supabase SQL editor):
 *   ALTER TABLE schools
 *     ADD COLUMN IF NOT EXISTS latitude          DOUBLE PRECISION,
 *     ADD COLUMN IF NOT EXISTS longitude         DOUBLE PRECISION,
 *     ADD COLUMN IF NOT EXISTS geo_radius_meters INTEGER DEFAULT 300;
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Navigation, Save, Loader2, CheckCircle2,
  AlertTriangle, Info, Pencil, X,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

/* ── Configured read-only card ───────────────────────── */
const ConfiguredCard = ({ school, onEdit, onClear, clearing }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.97 }}
    animate={{ opacity: 1, scale: 1 }}
    className="glass rounded-2xl p-6 border border-emerald-500/30 bg-emerald-500/5 space-y-5"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <p className="font-black text-base text-emerald-400">{t('geoActive')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('geoActiveDesc').replace('{n}', school.geo_radius_meters ?? 300) || `Teachers must be within`}{' '}
            <span className="font-bold text-foreground">{school.geo_radius_meters ?? 300} m</span>{' '}
            
          </p>
        </div>
      </div>
      <button
        onClick={onEdit}
        className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-all"
      >
        <Pencil className="h-3.5 w-3.5" /> {t('edit')}
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

    <div className="p-4 rounded-xl bg-white/4 border border-white/8 flex items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">{t('allowedRadius').replace(' (metres)', '')}</p>
        <p className="font-bold text-sm">
          {school.geo_radius_meters ?? 300}{' '}
          <span className="text-muted-foreground font-normal">{t('metres')}</span>
        </p>
      </div>
      <div className="flex-1 max-w-[140px]">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
            style={{ width: `${Math.min(100, ((school.geo_radius_meters ?? 300) / 1000) * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-right">
          {school.geo_radius_meters ?? 300} / 1000 m
        </p>
      </div>
    </div>

    {school.name && (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span className="font-semibold text-foreground">{school.name}</span>
      </div>
    )}

    <button
      onClick={onClear}
      disabled={clearing}
      className="text-xs text-red-400/70 hover:text-red-400 transition-colors underline underline-offset-2 disabled:opacity-50"
    >
      {clearing ? 'Disabling…' : t('disableGeo')}
    </button>
  </motion.div>
);

/* ════════════════════════════════════════════════════════ */
const AdminSchoolSettingsPage = () => {
  const { toast } = useToast();
  const { t }     = useLanguage();

  const schoolId = localStorage.getItem('schoolId');

  const [loading,      setLoading]      = useState(true);
  const [school,       setSchool]       = useState(null);
  const [isConfigured, setIsConfigured] = useState(false); // set from DB, never derived
  const [editMode,     setEditMode]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [clearing,     setClearing]     = useState(false);
  const [locating,     setLocating]     = useState(false);

  const [lat,    setLat]    = useState('');
  const [lng,    setLng]    = useState('');
  const [radius, setRadius] = useState('300');

  /* ── parse schoolId safely ──────────────────────────── */
  const parsedSchoolId = parseInt(schoolId, 10);

  /* ── fetch on mount ─────────────────────────────────── */
  useEffect(() => {
    if (!schoolId || isNaN(parsedSchoolId)) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('schools')
          .select('id, name, latitude, longitude, geo_radius_meters')
          .eq('id', parsedSchoolId)
          .maybeSingle();

        if (error) {
          // Columns may not exist yet — still open the form, but log the error
          console.warn('School settings fetch error (columns may need migration):', error.message);
          setIsConfigured(false);
          setEditMode(true);
          return;
        }

        if (!data) {
          // No matching school row
          console.warn('No school row found for id:', parsedSchoolId);
          setIsConfigured(false);
          setEditMode(true);
          return;
        }

        // Row found — determine configured state from actual DB values
        setSchool(data);
        const configured = data.latitude != null && data.longitude != null;
        setIsConfigured(configured);  // ← ground truth from DB
        setEditMode(!configured);

        // Pre-fill form fields for if/when admin opens edit mode
        setLat(data.latitude  != null ? String(data.latitude)           : '');
        setLng(data.longitude != null ? String(data.longitude)          : '');
        setRadius(data.geo_radius_meters != null ? String(data.geo_radius_meters) : '300');

      } finally {
        setLoading(false);
      }
    })();
  }, []);   // runs once on mount only — no dependency on schoolId to avoid re-runs

  /* ── GPS shortcut ───────────────────────────────────── */
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'GPS not available', description: 'Your browser does not support geolocation.' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setLocating(false);
        toast({
          title: t('locationCaptured'),
          description: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} · accuracy ±${Math.round(pos.coords.accuracy)} m`,
        });
      },
      (err) => {
        setLocating(false);
        toast({ variant: 'destructive', title: t('locationDenied'), description: err.message || 'Could not get GPS position.' });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  /* ── save ───────────────────────────────────────────── */
  const handleSave = async () => {
    const parsedLat    = parseFloat(lat);
    const parsedLng    = parseFloat(lng);
    const parsedRadius = parseInt(radius, 10);

    if (lat && (isNaN(parsedLat) || parsedLat < -90  || parsedLat > 90))  { toast({ variant: 'destructive', title: 'Invalid latitude',  description: 'Must be between -90 and 90.'   }); return; }
    if (lng && (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180)) { toast({ variant: 'destructive', title: 'Invalid longitude', description: 'Must be between -180 and 180.' }); return; }
    if (isNaN(parsedRadius) || parsedRadius < 50)                          { toast({ variant: 'destructive', title: 'Invalid radius',    description: 'Minimum radius is 50 metres.'  }); return; }

    setSaving(true);
    try {
      const payload = {
        latitude:          lat ? parsedLat : null,
        longitude:         lng ? parsedLng : null,
        geo_radius_meters: parsedRadius,
      };

      // ── KEY FIX: .select().single() makes Supabase error if 0 rows matched ──
      // This means we only proceed if the row was actually updated in the DB.
      // State is set from the DB-returned row, not from form values.
      const { data: saved, error } = await supabase
        .from('schools')
        .update(payload)
        .eq('id', parsedSchoolId)
        .select('id, name, latitude, longitude, geo_radius_meters')
        .single();

      if (error) throw error;
      if (!saved) throw new Error('Update matched no rows — check the school ID.');

      // Set state from the actual DB response
      setSchool(saved);
      const nowConfigured = saved.latitude != null && saved.longitude != null;
      setIsConfigured(nowConfigured);
      setEditMode(!nowConfigured);

      // Keep form fields in sync with what was saved
      setLat(saved.latitude  != null ? String(saved.latitude)           : '');
      setLng(saved.longitude != null ? String(saved.longitude)          : '');
      setRadius(saved.geo_radius_meters != null ? String(saved.geo_radius_meters) : '300');

      toast({
        title: `✓ ${t('settingsSaved')}`,
        description: nowConfigured
          ? `School location set · radius ${parsedRadius} m`
          : 'Geolocation disabled for this school.',
        className: 'bg-green-500/10 border-green-500/50 text-green-400',
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  /* ── disable / clear geo ────────────────────────────── */
  const handleClear = async () => {
    setClearing(true);
    try {
      const { data: cleared, error } = await supabase
        .from('schools')
        .update({ latitude: null, longitude: null, geo_radius_meters: 300 })
        .eq('id', parsedSchoolId)
        .select('id, name, latitude, longitude, geo_radius_meters')
        .single();

      if (error) throw error;
      if (!cleared) throw new Error('Update matched no rows.');

      setSchool(cleared);
      setIsConfigured(false);
      setEditMode(true);
      setLat(''); setLng(''); setRadius('300');

      toast({ title: t('geoDisabled'), description: t('geoDisabledDesc') });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to disable', description: err.message });
    } finally {
      setClearing(false);
    }
  };

  /* ── cancel edit ────────────────────────────────────── */
  const handleCancelEdit = () => {
    // Restore form to last saved DB values
    setLat(school?.latitude  != null ? String(school.latitude)           : '');
    setLng(school?.longitude != null ? String(school.longitude)          : '');
    setRadius(school?.geo_radius_meters != null ? String(school.geo_radius_meters) : '300');
    setEditMode(false);
  };

  /* ── render ─────────────────────────────────────────── */
  return (
    <>
      <Helmet><title>School Settings · Admin · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-2xl mx-auto space-y-7 pb-6">

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight">
              t('schoolSettings')
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('schoolSettingsDesc') ||
                "Set the school's GPS coordinates so teachers can only sign logbooks from campus."}
            </p>
          </motion.div>

          {/* Skeletons until fetch is done — nothing else renders while loading=true */}
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">

              {/* ── CONFIGURED MODE ─────────────────────── */}
              {isConfigured && !editMode && (
                <motion.div key="configured"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                  <ConfiguredCard
                    school={school}
                    onEdit={() => setEditMode(true)}
                    onClear={handleClear}
                    clearing={clearing}
                  />
                </motion.div>
              )}

              {/* ── EDIT / SETUP MODE ───────────────────── */}
              {(!isConfigured || editMode) && (
                <motion.div key="edit"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
                  className="space-y-5">

                  {/* Warning only when truly not yet configured */}
                  {!isConfigured && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/25 bg-amber-500/6">
                      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm text-amber-400">{t('geoNotConfigured')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('geoNotConfiguredDesc')}
                        </p>
                      </div>
                    </div>
                  )}

                  {school?.name && (
                    <div className="px-4 py-3 rounded-xl bg-white/4 border border-white/8 flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-indigo-400 shrink-0" />
                      <div>
                        <p className="font-bold text-sm">{school.name}</p>

                      </div>
                    </div>
                  )}

                  <div className="glass rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-500/15">
                          <MapPin className="h-4 w-4 text-indigo-400" />
                        </div>
                        <h2 className="font-bold">
                          {editMode && isConfigured ? t('editLocation') : t('setSchoolLocation')}
                        </h2>
                      </div>
                      <button
                        onClick={handleLocateMe}
                        disabled={locating}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/15 transition-all disabled:opacity-60"
                      >
                        {locating
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('geoLocating')}</>
                          : <><Navigation className="h-3.5 w-3.5" /> {t('useMyLocation')}</>}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Latitude</Label>
                        <Input type="number" step="any" placeholder="e.g. 3.8480"
                          value={lat} onChange={e => setLat(e.target.value)}
                          className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50 font-mono text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Longitude</Label>
                        <Input type="number" step="any" placeholder="e.g. 11.5021"
                          value={lng} onChange={e => setLng(e.target.value)}
                          className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50 font-mono text-sm" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {t('allowedRadius').replace(' (metres)', '')} (metres)
                      </Label>
                      <Input type="number" min="50" max="5000" step="50"
                        value={radius} onChange={e => setRadius(e.target.value)}
                        className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50" />
                      <p className="text-[11px] text-muted-foreground">{t('radiusHint')}</p>
                    </div>

                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-white/4 border border-white/8 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-indigo-400" />
                      <span>
                        Leave fields blank to disable enforcement.
                        <span className="text-indigo-400 font-semibold mt-1 block">
                          Run once in Supabase:{' '}
                          <code className="font-mono">
                            ALTER TABLE schools ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION, ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION, ADD COLUMN IF NOT EXISTS geo_radius_meters INTEGER DEFAULT 300;
                          </code>
                        </span>
                      </span>
                    </div>

                    <div className={cn('grid gap-3', editMode && isConfigured ? 'grid-cols-2' : 'grid-cols-1')}>
                      {editMode && isConfigured && (
                        <button onClick={handleCancelEdit}
                          className="py-3.5 rounded-2xl font-bold text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                          <X className="h-4 w-4" /> {t('cancel')}
                        </button>
                      )}
                      <button onClick={handleSave} disabled={saving}
                        className="py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
                        {saving
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('submitting')}</>
                          : <><Save className="h-4 w-4" /> {t('saveSettings')}</>}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </PageTransition>
    </>
  );
};

export default AdminSchoolSettingsPage;
