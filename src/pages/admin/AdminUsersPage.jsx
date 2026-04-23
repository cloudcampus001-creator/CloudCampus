/**
 * AdminUsersPage.jsx
 * User management with per-role ID format configuration and auto-generation
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Pencil, Trash2, Search, Loader2,
  GraduationCap, UserCheck, Shield, BookOpen, Hash,
  ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

/* ─── Default formats ─── */
const DEFAULT_FORMATS = {
  students:   { prefix: 'STU', digits: 5 },
  teachers:   { prefix: 'TCH', digits: 4 },
  discipline: { prefix: 'DM',  digits: 4 },
  vp:         { prefix: 'VP',  digits: 3 },
};

/* ─── ID generation helpers ─── */
const randomDigits = (n) => {
  const min = Math.pow(10, n - 1);
  const max = Math.pow(10, n) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const generateFormatted = (fmt) => `${fmt.prefix}${randomDigits(fmt.digits)}`;

/* ─── Stepper ─── */
const Stepper = ({ value, onChange, min = 1, max = 10 }) => (
  <div className="flex items-center gap-2">
    <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
      className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-bold text-lg flex items-center justify-center">−</button>
    <div className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center font-mono font-bold text-sm min-w-[52px] justify-center">
      {value}
    </div>
    <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
      className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-bold text-lg flex items-center justify-center">+</button>
  </div>
);

/* ─── MultiCheckbox ─── */
const MultiCheckbox = ({ items, selected, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const selectedArr = Array.isArray(selected) ? selected : [];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full h-11 px-3 flex items-center justify-between rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/8 transition-all">
        <span className={selectedArr.length === 0 ? 'text-muted-foreground' : ''}>
          {selectedArr.length === 0 ? placeholder : `${selectedArr.length} selected`}
        </span>
        <span className="text-muted-foreground text-xs">▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="absolute top-full mt-1.5 left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-2xl border border-white/15 bg-zinc-900/95 backdrop-blur-xl shadow-xl p-2 space-y-0.5">
            {items.length === 0 && <p className="text-xs text-muted-foreground p-2">{placeholder}</p>}
            {items.map(item => {
              const checked = selectedArr.includes(item.value);
              return (
                <button key={item.value} type="button"
                  onClick={() => {
                    const next = checked ? selectedArr.filter(v => v !== item.value) : [...selectedArr, item.value];
                    onChange(next);
                  }}
                  className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition-all',
                    checked ? 'bg-indigo-500/15 text-indigo-300' : 'hover:bg-white/5 text-muted-foreground')}>
                  <div className={cn('h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                    checked ? 'bg-indigo-500 border-indigo-500' : 'border-white/20')}>
                    {checked && <span className="text-white text-[9px] font-black">✓</span>}
                  </div>
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── ID Format Settings Panel ─── */
const FormatSettingsPanel = ({ tab, fmt, onSave, saving }) => {
  const [open,  setOpen]  = useState(false);
  const [draft, setDraft] = useState(fmt);

  useEffect(() => { setDraft(fmt); }, [fmt]);

  const hasChanges = draft.prefix !== fmt.prefix || draft.digits !== fmt.digits;
  const exampleId  = `${draft.prefix}${randomDigits(draft.digits)}`;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
      {/* Header toggle */}
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/4 transition-all">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
            <Hash className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <span className="text-sm font-bold">ID Format</span>
          <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
            {fmt.prefix}{'#'.repeat(fmt.digits)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">Configure auto-generation</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded settings */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/8">

              <div className="grid grid-cols-2 gap-4">
                {/* Prefix */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Prefix</Label>
                  <Input
                    value={draft.prefix}
                    onChange={e => setDraft(p => ({ ...p, prefix: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                    placeholder="e.g. STU"
                    maxLength={6}
                    className="bg-white/5 border-white/10 font-mono uppercase h-10"
                  />
                </div>

                {/* Digits */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Random Digits</Label>
                  <Stepper value={draft.digits} onChange={v => setDraft(p => ({ ...p, digits: v }))} min={2} max={9} />
                </div>
              </div>

              {/* Live preview */}
              <div className="p-3 rounded-xl bg-black/20 border border-white/6 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Preview</p>
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Format template</p>
                    <span className="font-mono text-sm font-bold text-indigo-300">
                      {draft.prefix || '—'}<span className="text-muted-foreground">{'#'.repeat(draft.digits)}</span>
                    </span>
                  </div>
                  <div className="h-6 w-px bg-white/10" />
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Example generated ID</p>
                    <span className="font-mono text-sm font-bold text-emerald-400">{exampleId}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button type="button"
                  onClick={() => { setDraft(fmt); setOpen(false); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                  Cancel
                </button>
                <button type="button"
                  disabled={!hasChanges || saving}
                  onClick={() => onSave(draft)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-all disabled:opacity-40">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Save Format
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════ */
const AdminUsersPage = () => {
  const { toast } = useToast();
  const { t }     = useLanguage();
  const schoolId  = localStorage.getItem('schoolId');

  const TABS = [
    { key: 'students',   label: t('tabStudents'),   icon: Users,         table: 'students' },
    { key: 'teachers',   label: t('tabTeachers'),   icon: GraduationCap, table: 'teachers' },
    { key: 'discipline', label: t('tabDiscipline'), icon: Shield,        table: 'discipline_masters' },
    { key: 'vp',         label: t('tabVP'),          icon: UserCheck,     table: 'vice_principals' },
    { key: 'admin',      label: t('tabAdmins'),      icon: BookOpen,      table: 'administrators' },
  ];

  const [activeTab,     setActiveTab]     = useState('students');
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');

  const [idFormats,     setIdFormats]     = useState(DEFAULT_FORMATS);
  const [formatSaving,  setFormatSaving]  = useState(false);

  const [schoolSubjects, setSchoolSubjects] = useState([]);
  const [allClasses,     setAllClasses]     = useState([]);

  const [sheetOpen,     setSheetOpen]     = useState(false);
  const [editingUser,   setEditingUser]   = useState(null);
  const [formData,      setFormData]      = useState({});
  const [formLoading,   setFormLoading]   = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState(null);

  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);

  const getTable = (tab) => TABS.find(t => t.key === tab)?.table || 'students';

  /* ── Load formats from school record ── */
  const fetchFormats = useCallback(async () => {
    if (!schoolId) return;
    const { data } = await supabase
      .from('schools')
      .select('id_formats')
      .eq('id', parseInt(schoolId))
      .maybeSingle();
    if (data?.id_formats) {
      setIdFormats({ ...DEFAULT_FORMATS, ...data.id_formats });
    }
  }, [schoolId]);

  /* ── Save a single tab's format ── */
  const saveFormat = async (tab, draft) => {
    setFormatSaving(true);
    try {
      const merged = { ...idFormats, [tab]: draft };
      const { error } = await supabase
        .from('schools')
        .update({ id_formats: merged })
        .eq('id', parseInt(schoolId));
      if (error) throw error;
      setIdFormats(merged);
      toast({
        title: '✅ Format saved',
        description: `New format: ${draft.prefix}${'#'.repeat(draft.digits)}`,
        className: 'bg-green-500/10 border-green-500/50 text-green-400',
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save format', description: err.message });
    } finally { setFormatSaving(false); }
  };

  useEffect(() => { fetchFormats(); }, [fetchFormats]);
  useEffect(() => { fetchUsers(); }, [activeTab, schoolId]);

  useEffect(() => {
    const load = async () => {
      if (!schoolId) return;
      const [{ data: subs }, { data: cls }] = await Promise.all([
        supabase.from('school_subjects').select('id, name').eq('school_id', parseInt(schoolId)).order('name'),
        supabase.from('classes').select('id, name').eq('school_id', parseInt(schoolId)).order('name'),
      ]);
      setSchoolSubjects(subs || []);
      setAllClasses(cls || []);
    };
    load();
  }, [schoolId]);

  const fetchUsers = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(getTable(activeTab))
        .select('*')
        .eq('school_id', parseInt(schoolId));
      if (error) throw error;
      setUsers(data || []);
    } catch {
      toast({ variant: 'destructive', title: t('error'), description: t('failedToLoadUsers') });
    } finally { setLoading(false); }
  };

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openSheet = (user = null) => {
    setEditingUser(user);
    if (user) {
      setFormData({ ...user });
      setSelectedSubjects(Array.isArray(user.subjects) ? user.subjects : []);
      setSelectedClassIds(
        Array.isArray(user.classes_teaching) ? user.classes_teaching.map(String) :
        Array.isArray(user.classes_managing) ? user.classes_managing.map(String) : []
      );
    } else {
      setFormData({});
      setSelectedSubjects([]);
      setSelectedClassIds([]);
    }
    setSheetOpen(true);
  };

  /* ── Auto-generate ID for any tab (all columns now varchar) ── */
  const applyAutoId = (dataToSave) => {
    const fmt = idFormats[activeTab] || DEFAULT_FORMATS[activeTab];
    if (!fmt) return;
    if (activeTab === 'students' && !dataToSave.matricule) {
      dataToSave.matricule = generateFormatted(fmt);
    } else if (activeTab !== 'students' && activeTab !== 'admin' && !dataToSave.id) {
      dataToSave.id = generateFormatted(fmt);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const table      = getTable(activeTab);
      const dataToSave = { ...formData, school_id: parseInt(schoolId) };

      if (activeTab === 'teachers') {
        dataToSave.subjects         = selectedSubjects;
        dataToSave.classes_teaching = selectedClassIds.map(id => parseInt(id));
      }
      if (activeTab === 'vp') {
        dataToSave.classes_managing = selectedClassIds.map(id => parseInt(id));
      }

      // Auto-generate ID on creation if left blank
      if (!editingUser) applyAutoId(dataToSave);

      let error;
      if (editingUser) {
        const idCol = activeTab === 'students' ? 'matricule' : 'id';
        ({ error } = await supabase.from(table).update(dataToSave).eq(idCol, editingUser[idCol]));
      } else {
        if (!dataToSave.id && activeTab !== 'students') delete dataToSave.id;
        ({ error } = await supabase.from(table).insert([dataToSave]));
      }

      if (error) throw error;
      toast({
        title: editingUser ? t('userUpdated') : t('userCreated'),
        className: 'bg-green-500/10 border-green-500/50 text-green-400',
      });
      setSheetOpen(false);
      fetchUsers();
    } catch (err) {
      toast({ variant: 'destructive', title: t('saveFailed'), description: err.message });
    } finally { setFormLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const idCol = activeTab === 'students' ? 'matricule' : 'id';
    const { error } = await supabase.from(getTable(activeTab)).delete().eq(idCol, deleteTarget);
    if (!error) {
      setUsers(prev => prev.filter(u => u[idCol] !== deleteTarget));
      toast({ title: t('userDeleted') });
    } else {
      toast({ variant: 'destructive', title: t('deleteFailed'), description: error.message });
    }
    setDeleteTarget(null);
  };

  const classItems   = allClasses.map(c => ({ value: c.id.toString(), label: c.name }));
  const subjectItems = schoolSubjects.map(s => ({ value: s.name, label: s.name }));

  const currentFmt       = idFormats[activeTab] || DEFAULT_FORMATS[activeTab];
  const idPlaceholder    = `Auto: ${currentFmt.prefix}${'#'.repeat(currentFmt.digits)}`;
  const showFormatPanel  = activeTab !== 'admin';

  const renderFormFields = () => {
    switch (activeTab) {
      case 'students': return (
        <>
          <Field label={t('fullNameLabel')}>
            <Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </Field>
          <Field label={t('matriculeIdLabel')} hint="Leave blank to auto-generate from the format above">
            <Input
              value={formData.matricule || ''}
              onChange={e => setFormData({ ...formData, matricule: e.target.value })}
              disabled={!!editingUser}
              placeholder={idPlaceholder}
              className="font-mono"
            />
          </Field>
          <Field label={t('classLabel')} hint={t('classForStudent')}>
            <Select value={formData.class_id?.toString() || ''} onValueChange={v => setFormData({ ...formData, class_id: parseInt(v) })}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl">
                <SelectValue placeholder={t('selectClassToManage')} />
              </SelectTrigger>
              <SelectContent>
                {allClasses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </>
      );
      case 'teachers': return (
        <>
          <Field label={t('teacherIdLabel')} hint="Leave blank to auto-generate from the format above">
            <Input
              value={formData.id || ''}
              onChange={e => setFormData({ ...formData, id: e.target.value })}
              disabled={!!editingUser}
              placeholder={idPlaceholder}
              className="font-mono"
            />
          </Field>
          <Field label={t('fullNameLabel')}>
            <Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </Field>
          <Field label={t('subjectsLabel')} hint={t('subjectsFromCatalogue')}>
            <MultiCheckbox items={subjectItems} selected={selectedSubjects} onChange={setSelectedSubjects} placeholder={t('selectSubjectsPlaceholder')} />
            {schoolSubjects.length === 0 && <p className="text-xs text-amber-400 mt-1">{t('addSubjectsFirst')}</p>}
          </Field>
          <Field label={t('classesTaughtLabel')} hint={t('selectClassesCoverHint')}>
            <MultiCheckbox items={classItems} selected={selectedClassIds} onChange={setSelectedClassIds} placeholder={t('selectClassesPlaceholder')} />
          </Field>
        </>
      );
      case 'vp': return (
        <>
          <Field label={t('vpIdLabel')} hint="Leave blank to auto-generate from the format above">
            <Input
              value={formData.id || ''}
              onChange={e => setFormData({ ...formData, id: e.target.value })}
              disabled={!!editingUser}
              placeholder={idPlaceholder}
              className="font-mono"
            />
          </Field>
          <Field label={t('fullNameLabel')}>
            <Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </Field>
          <Field label={t('managingClassesLabel')} hint={t('vpSupervisionHint')}>
            <MultiCheckbox items={classItems} selected={selectedClassIds} onChange={setSelectedClassIds} placeholder={t('selectClassesPlaceholder')} />
          </Field>
        </>
      );
      case 'discipline': return (
        <>
          <Field label={t('dmIdLabel')} hint="Leave blank to auto-generate from the format above">
            <Input
              value={formData.id || ''}
              onChange={e => setFormData({ ...formData, id: e.target.value })}
              disabled={!!editingUser}
              placeholder={idPlaceholder}
              className="font-mono"
            />
          </Field>
          <Field label={t('fullNameLabel')}>
            <Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </Field>
        </>
      );
      case 'admin': return (
        <>
          <Field label={t('fullNameLabel')}>
            <Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </Field>
          <Field label={t('adminPasswordLabel')} hint={t('setUpdatePassword')}>
            <Input type="password" value={formData.password_hash || ''} onChange={e => setFormData({ ...formData, password_hash: e.target.value })} placeholder={t('leaveBlankPassword')} />
          </Field>
        </>
      );
      default: return null;
    }
  };

  const getUserSub = (u) => {
    if (activeTab === 'students') return `${t('matriculePrefix')} ${u.matricule || '—'} · ${t('classIdPrefix')} ${u.class_id || '?'}`;
    if (activeTab === 'teachers') return `${t('subjectsPrefix')} ${Array.isArray(u.subjects) ? u.subjects.slice(0,2).join(', ') : '—'}`;
    if (activeTab === 'vp')       return `${t('classesPrefix')} ${Array.isArray(u.classes_managing) ? u.classes_managing.length : 0}`;
    return `${t('idPrefix')} ${u.id}`;
  };

  const currentTab = TABS.find(tab => tab.key === activeTab);

  return (
    <>
      <Helmet><title>{t('userManagementTitle')} · Admin</title></Helmet>
      <div className="space-y-7 pb-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{t('userManagementTitle')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{t('userManagementDesc')}</p>
          </div>
          <button onClick={() => openSheet()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white self-start sm:self-auto"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
            <Plus className="h-4 w-4" /> {t('add')} {currentTab?.label.slice(0,-1) || t('new')}
          </button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(tab => {
            const Icon   = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border whitespace-nowrap transition-all shrink-0',
                  active
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                    : 'bg-white/4 border-white/10 text-muted-foreground hover:bg-white/8')}>
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ID Format panel */}
        {showFormatPanel && (
          <FormatSettingsPanel
            key={activeTab}
            tab={activeTab}
            fmt={idFormats[activeTab] || DEFAULT_FORMATS[activeTab]}
            onSave={(draft) => saveFormat(activeTab, draft)}
            saving={formatSaving}
          />
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={`${t('search')} ${currentTab?.label.toLowerCase()}…`}
            className="pl-10 h-11 bg-white/5 border-white/10 rounded-xl"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* User list */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="animate-pulse h-16 rounded-2xl bg-white/5" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 glass rounded-2xl border border-white/8 gap-3 text-muted-foreground">
            <Users className="h-12 w-12 opacity-15" />
            <p>{t('noItemsAvailable')}</p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
            {filtered.map(user => (
              <motion.div key={user.id || user.matricule} variants={fadeUp}
                className="group glass rounded-2xl px-5 py-4 border border-white/8 hover:border-indigo-500/25 flex items-center gap-4 transition-all">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm"
                  style={{ background: 'linear-gradient(135deg,#6366f115,#8b5cf615)', border: '1px solid #6366f128', color: '#818cf8' }}>
                  {(user.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{user.name || '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{getUserSub(user)}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openSheet(user)}
                    className="h-8 w-8 rounded-lg hover:bg-indigo-500/15 flex items-center justify-center transition-all">
                    <Pencil className="h-3.5 w-3.5 text-indigo-400" />
                  </button>
                  <button onClick={() => setDeleteTarget(activeTab === 'students' ? user.matricule : user.id)}
                    className="h-8 w-8 rounded-lg hover:bg-red-500/15 flex items-center justify-center transition-all">
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/4 backdrop-blur-sm z-50" onClick={() => setSheetOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
              <div className="glass rounded-t-3xl p-6 border border-white/15 border-b-0"
                style={{ boxShadow: '0 -12px 50px rgba(99,102,241,0.15)', maxHeight: '92vh', overflowY: 'auto' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl"
                  style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                <div className="flex justify-center mb-4">
                  <div className="h-1 w-10 bg-white/20 rounded-full" />
                </div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-black">
                    {editingUser ? t('editUser') : `${t('new')} ${currentTab?.label.slice(0,-1) || ''}`}
                  </h2>
                  {!editingUser && showFormatPanel && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Sparkles className="h-2.5 w-2.5" /> ID auto-generates if blank
                    </span>
                  )}
                </div>
                <form onSubmit={handleSave} className="space-y-4">
                  {renderFormFields()}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" onClick={() => setSheetOpen(false)}
                      className="py-3.5 rounded-2xl font-bold text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all">
                      {t('cancel')}
                    </button>
                    <button type="submit" disabled={formLoading}
                      className="py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
                      {formLoading && <Loader2 className="h-4 w-4 animate-spin" />} {t('save')}
                    </button>
                  </div>
                </form>
                <div className="h-4" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget !== null && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setDeleteTarget(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="glass rounded-3xl p-7 border border-white/15 max-w-sm w-full">
                <h2 className="text-xl font-black mb-2">{t('deleteUserTitle')}</h2>
                <p className="text-sm text-muted-foreground mb-6">{t('deleteUserDesc')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDeleteTarget(null)}
                    className="py-3.5 rounded-2xl font-bold text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all">
                    {t('cancel')}
                  </button>
                  <button onClick={confirmDelete}
                    className="py-3.5 rounded-2xl font-bold text-sm text-white"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 6px 20px rgba(239,68,68,0.3)' }}>
                    {t('delete')}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

/* Field wrapper */
const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
  </div>
);

export default AdminUsersPage;
