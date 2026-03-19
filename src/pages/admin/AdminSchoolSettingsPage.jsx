/**
 * AdminSchoolSettingsPage.jsx
 * Allows the administrator to configure the school's geolocation:
 *   - latitude / longitude (required for teacher geo-validation)
 *   - geo_radius_meters (default 300 m)
 *
 * These values are stored in the `schools` table and used by
 * ActivityPage.jsx to verify teacher proximity before logbook signing.
 *
 * Required columns on the `schools` table (run once in Supabase SQL editor):
 *   ALTER TABLE schools ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
 *   ALTER TABLE schools ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
 *   ALTER TABLE schools ADD COLUMN IF NOT EXISTS geo_radius_meters INTEGER DEFAULT 300;
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Navigation, Save, Loader2, CheckCircle2,
  AlertTriangle, RefreshCw, Info,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } },
};

const AdminSchoolSettingsPage = () => {
  const { toast } = useToast();
  const { t }     = useLanguage();

  const schoolId = localStorage.getItem('schoolId');

  const [school,        setSchool]        = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [locating,      setLocating]      = useState(false);

  /* form fields */
  const [lat,    setLat]    = useState('');
  const [lng,    setLng]    = useState('');
  const [radius, setRadius] = useState('300');

  /* ── fetch current school record ────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, city, latitude, longitude, geo_radius_meters')
        .eq('id', parseInt(schoolId))
        .maybeSingle();

      if (!error && data) {
        setSchool(data);
        setLat(data.latitude  != null ? String(data.latitude)           : '');
        setLng(data.longitude != null ? String(data.longitude)          : '');
        setRadius(data.geo_radius_meters != null ? String(data.geo_radius_meters) : '300');
      }
      setLoading(false);
    })();
  }, [schoolId]);

  /* ── use browser geolocation ────────────────────────── */
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({
        variant: 'destructive',
        title: 'GPS not available',
        description: 'Your browser does not support geolocation.',
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setLocating(false);
        toast({
          title: 'Location captured',
          description: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} · accuracy ±${Math.round(pos.coords.accuracy)} m`,
        });
      },
      (err) => {
        setLocating(false);
        toast({
          variant: 'destructive',
          title: 'Location denied',
          description: err.message || 'Could not obtain GPS position.',
        });
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  /* ── save ───────────────────────────────────────────── */
  const handleSave = async () => {
    const parsedLat    = parseFloat(lat);
    const parsedLng    = parseFloat(lng);
    const parsedRadius = parseInt(radius, 10);

    if (lat && (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
      toast({ variant: 'destructive', title: 'Invalid latitude', description: 'Must be between -90 and 90.' });
      return;
    }
    if (lng && (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
      toast({ variant: 'destructive', title: 'Invalid longitude', description: 'Must be between -180 and 180.' });
      return;
    }
    if (isNaN(parsedRadius) || parsedRadius < 50) {
      toast({ variant: 'destructive', title: 'Invalid radius', description: 'Minimum radius is 50 metres.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        latitude:          lat ? parsedLat : null,
        longitude:         lng ? parsedLng : null,
        geo_radius_meters: parsedRadius,
      };
      const { error } = await supabase
        .from('schools')
        .update(payload)
        .eq('id', parseInt(schoolId));
      if (error) throw error;
      setSchool((prev) => ({ ...prev, ...payload }));
      toast({
        title: '✓ Settings saved',
        description: lat
          ? `School location set · radius ${parsedRadius} m`
          : 'Geolocation disabled for this school.',
        className: 'bg-green-500/10 border-green-500/50 text-green-400',
      });
    } catch (err) {
      toast({ variant: 'destructive', title: t('error'), description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = school?.latitude != null && school?.longitude != null;
  const hasUnsavedChanges =
    String(lat)    !== String(school?.latitude    ?? '') ||
    String(lng)    !== String(school?.longitude   ?? '') ||
    String(radius) !== String(school?.geo_radius_meters ?? 300);

  /* ── render ─────────────────────────────────────────── */
  return (
    <>
      <Helmet>
        <title>School Settings · Admin · CloudCampus</title>
      </Helmet>
      <PageTransition>
        <div className="max-w-2xl mx-auto space-y-7 pb-6">

          {/* ── Header ─────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight">
              {t('schoolSettings') || 'School Settings'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('schoolSettingsDesc') ||
                'Configure geolocation so teachers can only sign logbooks from the school campus.'}
            </p>
          </motion.div>

          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">

              {/* ── Status card ──────────────────────────── */}
              <motion.div variants={fadeUp}>
                <div
                  className={cn(
                    'flex items-start gap-4 p-5 rounded-2xl border',
                    isConfigured
                      ? 'bg-emerald-500/6 border-emerald-500/25'
                      : 'bg-amber-500/6 border-amber-500/25',
                  )}
                >
                  <div
                    className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                      isConfigured ? 'bg-emerald-500/20' : 'bg-amber-500/15',
                    )}
                  >
                    {isConfigured
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      : <AlertTriangle className="h-5 w-5 text-amber-400" />}
                  </div>
                  <div>
                    <p className={cn('font-bold text-sm', isConfigured ? 'text-emerald-400' : 'text-amber-400')}>
                      {isConfigured ? 'Geolocation is active' : 'Geolocation not configured'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isConfigured
                        ? `Teachers within ${school.geo_radius_meters ?? 300} m of this school can sign the logbook.`
                        : 'Set the coordinates below to enable geo-validation for teachers.'}
                    </p>
                    {isConfigured && (
                      <p className="text-[11px] font-mono mt-2 text-muted-foreground">
                        {school.latitude?.toFixed(6)}, {school.longitude?.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* ── School name (read-only) ──────────────── */}
              {school?.name && (
                <motion.div variants={fadeUp}>
                  <div className="px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-sm">
                    <span className="text-muted-foreground text-xs uppercase tracking-widest font-bold">School</span>
                    <p className="font-bold mt-1">{school.name}</p>
                    {school.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {school.city}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── Coordinates form ─────────────────────── */}
              <motion.div variants={fadeUp} className="glass rounded-2xl p-6 space-y-5">

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/15">
                      <MapPin className="h-4.5 w-4.5 text-indigo-400" />
                    </div>
                    <h2 className="font-bold">
                      {t('schoolLocation') || 'School Location'}
                    </h2>
                  </div>

                  {/* Use current location button */}
                  <button
                    onClick={handleLocateMe}
                    disabled={locating}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/15 transition-all disabled:opacity-60"
                  >
                    {locating
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Locating…</>
                      : <><Navigation className="h-3.5 w-3.5" /> Use my location</>}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Latitude
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="e.g. 3.8480"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50 font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Longitude
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="e.g. 11.5021"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Allowed radius (metres)
                  </Label>
                  <Input
                    type="number"
                    min="50"
                    max="5000"
                    step="50"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Teachers must be within this distance of the school to sign the logbook.
                    Recommended: 100 – 500 m.
                  </p>
                </div>

                {/* Info note */}
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-white/4 border border-white/8 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-indigo-400" />
                  <span>
                    Leave latitude and longitude blank to disable geolocation enforcement —
                    teachers will be able to sign logbooks from anywhere.
                    <br />
                    <span className="text-indigo-400 font-semibold mt-1 block">
                      SQL required once:{' '}
                      <code className="font-mono">
                        ALTER TABLE schools ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
                        ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
                        ADD COLUMN IF NOT EXISTS geo_radius_meters INTEGER DEFAULT 300;
                      </code>
                    </span>
                  </span>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSave}
                  disabled={saving || !hasUnsavedChanges}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.97] disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    boxShadow: '0 6px 20px rgba(99,102,241,0.3)',
                  }}
                >
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    : <><Save className="h-4 w-4" /> {t('save') || 'Save settings'}</>}
                </button>
              </motion.div>

            </motion.div>
          )}
        </div>
      </PageTransition>
    </>
  );
};

export default AdminSchoolSettingsPage;
