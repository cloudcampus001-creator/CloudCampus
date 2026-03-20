/**
 * AdminReportTemplatePage.jsx
 * Lets the administrator design the school's official report card header.
 * Fields are stored as columns on the `schools` table.
 *
 * SQL migration (run once in Supabase):
 *   ALTER TABLE schools
 *     ADD COLUMN IF NOT EXISTS report_school_name   TEXT,
 *     ADD COLUMN IF NOT EXISTS report_motto         TEXT,
 *     ADD COLUMN IF NOT EXISTS report_address       TEXT,
 *     ADD COLUMN IF NOT EXISTS report_principal     TEXT,
 *     ADD COLUMN IF NOT EXISTS report_logo_url      TEXT,
 *     ADD COLUMN IF NOT EXISTS report_accent_color  TEXT DEFAULT '#7c3aed';
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Save, Loader2, CheckCircle2,
  Palette, FileText, Eye, EyeOff,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

const fadeUp = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/* ── Live preview of the report card header ───────────── */
const HeaderPreview = ({ fields }) => {
  const accent = fields.accent_color || '#7c3aed';
  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 12, color: '#1f2937', background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb' }}>
      <div style={{ textAlign: 'center', borderBottom: `3px solid ${accent}`, paddingBottom: 12, marginBottom: 12 }}>
        {fields.logo_url && (
          <img src={fields.logo_url} alt="logo" style={{ height: 56, objectFit: 'contain', marginBottom: 6, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
            onError={e => { e.target.style.display = 'none'; }} />
        )}
        <div style={{ fontSize: 17, fontWeight: 800, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}>
          {fields.school_name || 'School Name'}
        </div>
        {fields.motto && (
          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#6b7280', marginTop: 3 }}>
            "{fields.motto}"
          </div>
        )}
        {fields.address && (
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{fields.address}</div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 6, letterSpacing: 3, textTransform: 'uppercase' }}>
          ACADEMIC REPORT CARD
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, marginTop: 10, fontSize: 11 }}>
          <span><b>Student:</b> _______________</span>
          <span><b>Class:</b> _______________</span>
          <span><b>Period:</b> _______________</span>
          <span><b>Date:</b> {new Date().toLocaleDateString()}</span>
        </div>
      </div>
      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, marginBottom: 10 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginTop: 16 }}>
        <span>Class Teacher: ____________________</span>
        {fields.principal && <span>Principal: {fields.principal}</span>}
        <span>Parent: ____________________</span>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════ */
const AdminReportTemplatePage = () => {
  const { toast } = useToast();
  const { t }     = useLanguage();

  const schoolId = localStorage.getItem('schoolId');

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [preview,  setPreview]  = useState(true);

  const [fields, setFields] = useState({
    school_name:   '',
    motto:         '',
    address:       '',
    principal:     '',
    logo_url:      '',
    accent_color:  '#7c3aed',
  });

  /* ── fetch existing template ────────────────────────── */
  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('schools')
        .select('name, report_school_name, report_motto, report_address, report_principal, report_logo_url, report_accent_color')
        .eq('id', parseInt(schoolId))
        .maybeSingle();

      if (data) {
        setFields({
          school_name:  data.report_school_name  || data.name || '',
          motto:        data.report_motto        || '',
          address:      data.report_address      || '',
          principal:    data.report_principal    || '',
          logo_url:     data.report_logo_url     || '',
          accent_color: data.report_accent_color || '#7c3aed',
        });
      }
      setLoading(false);
    })();
  }, [schoolId]);

  const set = (key, val) => setFields(p => ({ ...p, [key]: val }));

  /* ── save ───────────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('schools').update({
        report_school_name:  fields.school_name,
        report_motto:        fields.motto,
        report_address:      fields.address,
        report_principal:    fields.principal,
        report_logo_url:     fields.logo_url,
        report_accent_color: fields.accent_color,
      }).eq('id', parseInt(schoolId));

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: `✓ ${t('templateSaved')}`, description: t('templateSavedDesc'), className: 'bg-green-500/10 border-green-500/50 text-green-400' });
    } catch (err) {
      toast({ variant: 'destructive', title: t('error'), description: err.message });
    } finally {
      setSaving(false);
    }
  };

  /* ── render ─────────────────────────────────────────── */
  return (
    <>
      <Helmet><title>{t('reportTemplate')} · Admin · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-4xl mx-auto space-y-7 pb-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight">{t('reportTemplate')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('reportTemplateDesc')}
            </p>
          </motion.div>

          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── Form ─────────────────────────────────── */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-5">

                <div className="glass rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="p-2 rounded-xl bg-indigo-500/15">
                      <FileText className="h-4 w-4 text-indigo-400" />
                    </div>
                    <h2 className="font-bold">{t('schoolInfoSection')}</h2>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('schoolOfficialName')}</Label>
                    <Input value={fields.school_name} onChange={e => set('school_name', e.target.value)}
                      placeholder="e.g. Collège Saint-Paul de Yaoundé"
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('schoolMotto')}</Label>
                    <Input value={fields.motto} onChange={e => set('motto', e.target.value)}
                      placeholder="e.g. Excellence through discipline"
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('schoolAddress')}</Label>
                    <Input value={fields.address} onChange={e => set('address', e.target.value)}
                      placeholder="e.g. B.P. 1234, Yaoundé, Cameroun"
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('principalName')}</Label>
                    <Input value={fields.principal} onChange={e => set('principal', e.target.value)}
                      placeholder="e.g. Rev. Fr. Jean-Paul Mbarga"
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50" />
                  </div>
                </div>

                <div className="glass rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="p-2 rounded-xl bg-purple-500/15">
                      <Palette className="h-4 w-4 text-purple-400" />
                    </div>
                    <h2 className="font-bold">{t('brandingSection')}</h2>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('logoUrl')}</Label>
                    <Input value={fields.logo_url} onChange={e => set('logo_url', e.target.value)}
                      placeholder="https://yourschool.com/logo.png"
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50 font-mono text-xs" />
                    <p className="text-[11px] text-muted-foreground">{t('logoUrlHint')}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('accentColor')}</Label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={fields.accent_color}
                        onChange={e => set('accent_color', e.target.value)}
                        className="h-11 w-16 rounded-xl cursor-pointer border border-white/10 bg-transparent p-1" />
                      <Input value={fields.accent_color} onChange={e => set('accent_color', e.target.value)}
                        placeholder="#7c3aed" maxLength={7}
                        className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50 font-mono flex-1" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t('accentColorHint')}</p>
                  </div>
                </div>

                {/* Migration note */}
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-white/4 border border-white/8 text-xs text-muted-foreground">
                  <span className="text-indigo-400 font-semibold">SQL (run once):</span>
                  <code className="font-mono text-indigo-300 text-[10px] leading-relaxed">
                    ALTER TABLE schools ADD COLUMN IF NOT EXISTS report_school_name TEXT, ADD COLUMN IF NOT EXISTS report_motto TEXT, ADD COLUMN IF NOT EXISTS report_address TEXT, ADD COLUMN IF NOT EXISTS report_principal TEXT, ADD COLUMN IF NOT EXISTS report_logo_url TEXT, ADD COLUMN IF NOT EXISTS report_accent_color TEXT DEFAULT '#7c3aed';
                  </code>
                </div>

                {/* Save button */}
                <button onClick={handleSave} disabled={saving}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.97] disabled:opacity-60',
                    saved ? 'bg-gradient-to-r from-green-500 to-emerald-500' : ''
                  )}
                  style={!saved ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' } : {}}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('templateSaving')}</>
                    : saved  ? <><CheckCircle2 className="h-4 w-4" /> {t('templateSavedBtn')}</>
                    : <><Save className="h-4 w-4" /> {t('saveTemplate')}</>}
                </button>
              </motion.div>

              {/* ── Live preview ─────────────────────────── */}
              <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm">{t('livePreview')}</h2>
                  <button onClick={() => setPreview(p => !p)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {preview ? t('previewHide') : t('previewShow')}
                  </button>
                </div>
                {preview && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <HeaderPreview fields={fields} />
                    <p className="text-[11px] text-muted-foreground mt-3 text-center">
                      {t('previewFooter')}
                    </p>
                  </motion.div>
                )}
              </motion.div>

            </div>
          )}
        </div>
      </PageTransition>
    </>
  );
};

export default AdminReportTemplatePage;
