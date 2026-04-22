/**
 * AdminReportTemplatePage.jsx
 * Full report card template designer.
 * Fields stored on the `schools` table.
 *
 * SQL migration (run once in Supabase if not already done):
 *   ALTER TABLE schools
 *     ADD COLUMN IF NOT EXISTS report_school_name    TEXT,
 *     ADD COLUMN IF NOT EXISTS report_motto          TEXT,
 *     ADD COLUMN IF NOT EXISTS report_address        TEXT,
 *     ADD COLUMN IF NOT EXISTS report_city           TEXT,
 *     ADD COLUMN IF NOT EXISTS report_phone          TEXT,
 *     ADD COLUMN IF NOT EXISTS report_email          TEXT,
 *     ADD COLUMN IF NOT EXISTS report_principal      TEXT,
 *     ADD COLUMN IF NOT EXISTS report_vp_name        TEXT,
 *     ADD COLUMN IF NOT EXISTS report_logo_url       TEXT,
 *     ADD COLUMN IF NOT EXISTS report_stamp_url      TEXT,
 *     ADD COLUMN IF NOT EXISTS report_signature_url  TEXT,
 *     ADD COLUMN IF NOT EXISTS report_accent_color   TEXT DEFAULT '#6366f1',
 *     ADD COLUMN IF NOT EXISTS report_show_stamp     BOOLEAN DEFAULT true,
 *     ADD COLUMN IF NOT EXISTS report_header_note    TEXT,
 *     ADD COLUMN IF NOT EXISTS report_ministry_label TEXT;
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap, Save, Loader2, CheckCircle2,
  Palette, Image, Upload, Phone, Mail, MapPin,
  User, PenLine, Building, Eye,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

const fadeUp = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

/* ── Section wrapper ───────────────────────────────── */
const Section = ({ icon: Icon, title, children }) => (
  <div className="glass rounded-2xl border border-white/10 overflow-hidden">
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/8 bg-white/3">
      <div className="h-8 w-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-indigo-400" />
      </div>
      <p className="font-bold text-sm">{title}</p>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
  </div>
);

/* ── Live preview ────────────────────────────────── */
const HeaderPreview = ({ fields }) => {
  const accent = fields.accent_color || '#6366f1';
  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 12, color: '#1f2937', background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e5e7eb', maxWidth: 640 }}>
      {/* Ministry / Region header */}
      {fields.ministry_label && (
        <div style={{ textAlign: 'center', fontSize: 10, color: '#6b7280', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
          {fields.ministry_label}
        </div>
      )}
      <div style={{ textAlign: 'center', borderBottom: `3px solid ${accent}`, paddingBottom: 12, marginBottom: 12 }}>
        {fields.logo_url && (
          <img src={fields.logo_url} alt="logo"
            style={{ height: 60, objectFit: 'contain', marginBottom: 6, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
            onError={e => { e.target.style.display = 'none'; }} />
        )}
        <div style={{ fontSize: 17, fontWeight: 900, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}>
          {fields.school_name || 'School Name'}
        </div>
        {fields.motto && (
          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#6b7280', marginTop: 3 }}>"{fields.motto}"</div>
        )}
        {fields.header_note && (
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{fields.header_note}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 5, fontSize: 10, color: '#9ca3af' }}>
          {fields.city    && <span>📍 {fields.city}</span>}
          {fields.phone   && <span>📞 {fields.phone}</span>}
          {fields.email   && <span>✉ {fields.email}</span>}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 8, letterSpacing: 3, textTransform: 'uppercase', background: accent, color: '#fff', padding: '4px 0', borderRadius: 3 }}>
          BULLETIN DE NOTES
        </div>
      </div>

      {/* Mock table */}
      <div style={{ height: 60, background: '#f9fafb', borderRadius: 4, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 11 }}>
        [ Tableau des notes ]
      </div>

      {/* Signature block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 10, fontSize: 10 }}>
        <div style={{ flex: 1, borderTop: '1px solid #d1d5db', paddingTop: 6, textAlign: 'center' }}>
          <div style={{ color: '#6b7280' }}>Signature du Parent / Tuteur</div>
        </div>
        <div style={{ flex: 1, borderTop: '1px solid #d1d5db', paddingTop: 6, textAlign: 'center' }}>
          <div style={{ color: '#6b7280' }}>Prof. Principal</div>
        </div>
        <div style={{ flex: 1, borderTop: '1px solid #d1d5db', paddingTop: 6, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: '#374151' }}>{fields.vp_name || 'Censeur / Proviseur'}</div>
          {fields.stamp_url && (
            <img src={fields.stamp_url} alt="stamp"
              style={{ height: 40, objectFit: 'contain', display: 'block', margin: '4px auto 0' }}
              onError={e => { e.target.style.display = 'none'; }} />
          )}
          {fields.signature_url && (
            <img src={fields.signature_url} alt="signature"
              style={{ height: 30, objectFit: 'contain', display: 'block', margin: '2px auto 0' }}
              onError={e => { e.target.style.display = 'none'; }} />
          )}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════ */
const AdminReportTemplatePage = () => {
  const { toast } = useToast();
  const schoolId  = localStorage.getItem('schoolId');

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [preview, setPreview] = useState(false);

  const [fields, setFields] = useState({
    school_name:      '',
    motto:            '',
    address:          '',
    city:             '',
    phone:            '',
    email:            '',
    principal:        '',
    vp_name:          '',
    logo_url:         '',
    stamp_url:        '',
    signature_url:    '',
    accent_color:     '#6366f1',
    ministry_label:   '',
    header_note:      '',
    show_stamp:       true,
  });

  useEffect(() => {
    if (!schoolId) return;
    supabase.from('schools').select('*').eq('id', parseInt(schoolId)).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFields({
            school_name:    data.report_school_name    || data.name || '',
            motto:          data.report_motto          || '',
            address:        data.report_address        || data.address || '',
            city:           data.report_city           || '',
            phone:          data.report_phone          || data.phone || '',
            email:          data.report_email          || data.email || '',
            principal:      data.report_principal      || '',
            vp_name:        data.report_vp_name        || '',
            logo_url:       data.report_logo_url       || data.logo_url || '',
            stamp_url:      data.report_stamp_url      || '',
            signature_url:  data.report_signature_url  || '',
            accent_color:   data.report_accent_color   || '#6366f1',
            ministry_label: data.report_ministry_label || '',
            header_note:    data.report_header_note    || '',
            show_stamp:     data.report_show_stamp !== false,
          });
        }
        setLoading(false);
      });
  }, [schoolId]);

  const set = (key, val) => {
    setSaved(false);
    setFields(p => ({ ...p, [key]: val }));
  };

  const handleSave = async () => {
    if (!schoolId) return;
    setSaving(true);
    const { error } = await supabase.from('schools').update({
      report_school_name:   fields.school_name    || null,
      report_motto:         fields.motto          || null,
      report_address:       fields.address        || null,
      report_city:          fields.city           || null,
      report_phone:         fields.phone          || null,
      report_email:         fields.email          || null,
      report_principal:     fields.principal      || null,
      report_vp_name:       fields.vp_name        || null,
      report_logo_url:      fields.logo_url       || null,
      report_stamp_url:     fields.stamp_url      || null,
      report_signature_url: fields.signature_url  || null,
      report_accent_color:  fields.accent_color   || '#6366f1',
      report_ministry_label: fields.ministry_label || null,
      report_header_note:   fields.header_note    || null,
      report_show_stamp:    fields.show_stamp,
    }).eq('id', parseInt(schoolId));

    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    setSaved(true);
    toast({ title: '✅ Template saved', description: 'Your report card template has been updated.' });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  return (
    <PageTransition>
      <Helmet><title>Report Card Template · CloudCampus</title></Helmet>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-black text-2xl">Report Card Template</h1>
              <p className="text-sm text-muted-foreground">Customize the header, logo, and signatures on all bulletins</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setPreview(p => !p)}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all',
                preview ? 'bg-white/10 border-white/20 text-foreground' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
              <Eye className="h-3.5 w-3.5" /> {preview ? 'Hide' : 'Preview'}
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-all disabled:opacity-60 shadow-lg shadow-indigo-500/30">
              {saving  ? <Loader2 className="h-4 w-4 animate-spin" />
               : saved ? <CheckCircle2 className="h-4 w-4 text-emerald-300" />
               :         <Save className="h-4 w-4" />}
              {saved ? 'Saved' : 'Save Template'}
            </button>
          </div>
        </motion.div>

        {/* Live Preview */}
        {preview && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 px-1">Live Preview</p>
            <div className="overflow-x-auto rounded-2xl border border-white/10 p-4 bg-white/3">
              <HeaderPreview fields={fields} />
            </div>
          </motion.div>
        )}

        {/* ── Section 1: Identity ── */}
        <Section icon={Building} title="School Identity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Official School Name" hint="Displayed on every report card">
              <Input value={fields.school_name} onChange={e => set('school_name', e.target.value)}
                placeholder="e.g. GBHS Obili" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
            </Field>
            <Field label="Ministry / Region Header" hint="e.g. Republic of Cameroon — Ministry of Secondary Education">
              <Input value={fields.ministry_label} onChange={e => set('ministry_label', e.target.value)}
                placeholder="République du Cameroun…" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
            </Field>
          </div>
          <Field label="School Motto" hint="Displayed in italics under the name">
            <Input value={fields.motto} onChange={e => set('motto', e.target.value)}
              placeholder="e.g. Excellence & Integrity" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
          </Field>
          <Field label="Additional Header Note" hint="Small text under motto, e.g. BP 123, Yaoundé">
            <Input value={fields.header_note} onChange={e => set('header_note', e.target.value)}
              placeholder="Optional note" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="City">
              <Input value={fields.city} onChange={e => set('city', e.target.value)}
                placeholder="Yaoundé" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
            </Field>
            <Field label="Phone">
              <Input value={fields.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+237 6…" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
            </Field>
            <Field label="Email">
              <Input value={fields.email} onChange={e => set('email', e.target.value)} type="email"
                placeholder="school@example.com" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
            </Field>
          </div>
          <Field label="Full Address">
            <Input value={fields.address} onChange={e => set('address', e.target.value)}
              placeholder="Street, District…" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
          </Field>
        </Section>

        {/* ── Section 2: Staff ── */}
        <Section icon={User} title="Staff Signatures">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Principal / Proviseur Name" hint="Shown in the principal signature block">
              <Input value={fields.principal} onChange={e => set('principal', e.target.value)}
                placeholder="M. / Mme …" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
            </Field>
            <Field label="Censeur / VP Name" hint="Shown in the VP/Censeur signature block">
              <Input value={fields.vp_name} onChange={e => set('vp_name', e.target.value)}
                placeholder="M. / Mme …" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
            </Field>
          </div>
        </Section>

        {/* ── Section 3: Visuals ── */}
        <Section icon={Image} title="Logo, Stamp & Signature">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="School Logo URL" hint="Displayed at top center">
              <Input value={fields.logo_url} onChange={e => set('logo_url', e.target.value)}
                placeholder="https://…/logo.png" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
              {fields.logo_url && (
                <img src={fields.logo_url} alt="logo preview" className="mt-2 h-12 object-contain rounded"
                  onError={e => { e.target.style.display = 'none'; }} />
              )}
            </Field>
            <Field label="Official Stamp URL" hint="School seal / cachet">
              <Input value={fields.stamp_url} onChange={e => set('stamp_url', e.target.value)}
                placeholder="https://…/stamp.png" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
              {fields.stamp_url && (
                <img src={fields.stamp_url} alt="stamp preview" className="mt-2 h-12 object-contain rounded"
                  onError={e => { e.target.style.display = 'none'; }} />
              )}
            </Field>
            <Field label="Signature Image URL" hint="Censeur/Principal handwritten signature">
              <Input value={fields.signature_url} onChange={e => set('signature_url', e.target.value)}
                placeholder="https://…/signature.png" className="bg-white/5 border-white/10 focus:border-indigo-500/50" />
              {fields.signature_url && (
                <img src={fields.signature_url} alt="sig preview" className="mt-2 h-10 object-contain rounded"
                  onError={e => { e.target.style.display = 'none'; }} />
              )}
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="show_stamp" checked={fields.show_stamp} onChange={e => set('show_stamp', e.target.checked)}
              className="h-4 w-4 rounded accent-indigo-500" />
            <label htmlFor="show_stamp" className="text-sm font-medium cursor-pointer">
              Show stamp & signature on printed report cards
            </label>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/15 text-xs text-indigo-300">
            💡 For logo, stamp, and signature images: upload them to Supabase Storage → get the public URL → paste it above.
          </div>
        </Section>

        {/* ── Section 4: Color ── */}
        <Section icon={Palette} title="Accent Color">
          <div className="flex items-center gap-4">
            <div className="relative">
              <input type="color" value={fields.accent_color} onChange={e => set('accent_color', e.target.value)}
                className="h-12 w-20 rounded-xl border border-white/10 cursor-pointer bg-transparent p-1" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: fields.accent_color }}>{fields.accent_color}</p>
              <p className="text-xs text-muted-foreground">Used for table headers, school name, and divider line</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['#6366f1','#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#1e40af'].map(c => (
                <button key={c} onClick={() => set('accent_color', c)}
                  className="h-7 w-7 rounded-lg border-2 transition-all"
                  style={{ background: c, borderColor: fields.accent_color === c ? '#fff' : 'transparent' }} />
              ))}
            </div>
          </div>
        </Section>

        {/* Save button at bottom */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all disabled:opacity-60 shadow-lg shadow-indigo-500/30">
            {saving  ? <Loader2 className="h-4 w-4 animate-spin" />
             : saved ? <CheckCircle2 className="h-4 w-4 text-emerald-300" />
             :         <Save className="h-4 w-4" />}
            {saved ? 'Template Saved ✓' : 'Save Template'}
          </button>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default AdminReportTemplatePage;
</file>

