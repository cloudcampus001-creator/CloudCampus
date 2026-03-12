/**
 * AdminClassesPage.jsx
 */
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  School, Plus, Pencil, Trash2, Search, Loader2,
  UserCheck, Shield, BookOpen, Hash, X, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const Skel    = () => <div className="animate-pulse h-36 rounded-2xl bg-white/5 border border-white/6" />;

/* ── Checkbox pill ─── */
const SubjectPill = ({ name, checked, onToggle }) => (
  <button type="button" onClick={onToggle}
    className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all',
      checked
        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
        : 'bg-white/4 border-white/10 text-muted-foreground hover:bg-white/8')}>
    <div className={cn('h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
      checked ? 'bg-indigo-500 border-indigo-500' : 'border-muted-foreground/30')}>
      {checked && <span className="text-white text-[9px] font-black leading-none">✓</span>}
    </div>
    <span className="truncate">{name}</span>
  </button>
);

/* ═══════════════════════════════════════════════════════ */
const AdminClassesPage = () => {
  const { toast }  = useToast();
  const { t }      = useLanguage();
  const schoolId   = localStorage.getItem('schoolId');

  const [classes,         setClasses]         = useState([]);
  const [vps,             setVps]             = useState([]);
  const [dms,             setDms]             = useState([]);
  const [schoolSubjects,  setSchoolSubjects]  = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [searchQuery,     setSearchQuery]     = useState('');

  const [sheetOpen,       setSheetOpen]       = useState(false);
  const [editingClass,    setEditingClass]    = useState(null);
  const [formData,        setFormData]        = useState({});
  const [selectedSubjects,setSelectedSubjects]= useState(new Set());
  const [formLoading,     setFormLoading]     = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState(null);

  useEffect(() => { fetchData(); }, [schoolId]);

  const fetchData = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [{ data: clsData }, { data: vpData }, { data: dmData }, { data: subData }] = await Promise.all([
        supabase.from('classes').select('*, vice_principals(name), discipline_masters(name)').eq('school_id', parseInt(schoolId)).order('name'),
        supabase.from('vice_principals').select('id, name').eq('school_id', parseInt(schoolId)),
        supabase.from('discipline_masters').select('id, name').eq('school_id', parseInt(schoolId)),
        supabase.from('school_subjects').select('id, name').eq('school_id', parseInt(schoolId)).order('name'),
      ]);
      setClasses(clsData || []);
      setVps(vpData || []);
      setDms(dmData || []);
      setSchoolSubjects(subData || []);
    } catch {
      toast({ variant: 'destructive', title: t('error'), description: t('failedToLoadUsers') });
    } finally { setLoading(false); }
  };

  const filtered = classes.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const openSheet = async (cls = null) => {
    setEditingClass(cls);
    setFormData(cls
      ? { name: cls.name, sector: cls.sector || '', vp_id: cls.vp_id?.toString() || '', dm_id: cls.dm_id?.toString() || '' }
      : { id: '', name: '', sector: '', vp_id: '', dm_id: '' }
    );
    if (cls) {
      const { data } = await supabase.from('class_subjects').select('subject').eq('class_id', cls.id);
      setSelectedSubjects(new Set((data || []).map(r => r.subject)));
    } else { setSelectedSubjects(new Set()); }
    setSheetOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingClass && !formData.id) {
      toast({ variant: 'destructive', title: t('classIdRequired'), description: t('classIdRequiredDesc') });
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        name: formData.name, sector: formData.sector, school_id: parseInt(schoolId),
        vp_id: formData.vp_id && formData.vp_id !== 'unassigned' ? parseInt(formData.vp_id) : null,
        dm_id: formData.dm_id && formData.dm_id !== 'unassigned' ? parseInt(formData.dm_id) : null,
      };

      let classId;
      if (editingClass) {
        const { error } = await supabase.from('classes').update(payload).eq('id', editingClass.id);
        if (error) throw error;
        classId = editingClass.id;
      } else {
        const { data, error } = await supabase.from('classes').insert([{ ...payload, id: parseInt(formData.id) }]).select().single();
        if (error) throw error;
        classId = data.id;
      }

      // Save subjects
      await supabase.from('class_subjects').delete().eq('class_id', classId);
      const chosen = [...selectedSubjects];
      if (chosen.length > 0) {
        await supabase.from('class_subjects').insert(
          chosen.map(subject => ({ class_id: classId, school_id: parseInt(schoolId), subject, is_obligatory: true }))
        );
      }

      toast({ title: `✓ ${editingClass ? t('classUpdated') : t('classCreated')}`, className: 'bg-green-500/10 border-green-500/50 text-green-400' });
      setSheetOpen(false);
      fetchData();
    } catch (err) {
      toast({ variant: 'destructive', title: t('saveFailed'), description: err.message });
    } finally { setFormLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('classes').delete().eq('id', deleteTarget);
      if (error) throw error;
      setClasses(prev => prev.filter(c => c.id !== deleteTarget));
      toast({ title: t('classDeleted') });
      setDeleteTarget(null);
    } catch {
      toast({ variant: 'destructive', title: t('deleteFailed'), description: t('ensureNoStudents') });
    }
  };

  return (
    <>
      <Helmet><title>{t('classManagement')} · Admin</title></Helmet>

      <div className="space-y-7 pb-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{t('classManagement')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{t('classManagementDesc')}</p>
          </div>
          <button onClick={() => openSheet()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] self-start sm:self-auto"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
            <Plus className="h-4 w-4" /> {t('addClass')}
          </button>
        </motion.div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder={t('searchClassesPlaceholder')} className="pl-10 h-11 bg-white/5 border-white/10 rounded-xl"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1,2,3,4,5,6].map(i => <Skel key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 glass rounded-2xl border border-white/8 gap-4 text-muted-foreground">
            <School className="h-12 w-12 opacity-15" />
            <p>{t('noClassesFound')}</p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(cls => (
              <motion.div key={cls.id} variants={fadeUp}
                className="group glass rounded-2xl p-5 border border-white/8 hover:border-indigo-500/30 hover:-translate-y-0.5 transition-all"
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.12)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-black text-lg">{cls.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/12 border border-indigo-500/20 text-indigo-400 font-semibold">
                        {cls.sector || t('generalSector')}
                      </span>
                      <span className="text-[11px] text-muted-foreground">ID: {cls.id}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openSheet(cls)}
                      className="h-8 w-8 rounded-lg bg-white/5 hover:bg-indigo-500/15 flex items-center justify-center transition-all">
                      <Pencil className="h-3.5 w-3.5 text-indigo-400" />
                    </button>
                    <button onClick={() => setDeleteTarget(cls.id)}
                      className="h-8 w-8 rounded-lg bg-white/5 hover:bg-red-500/15 flex items-center justify-center transition-all">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5 text-pink-400 shrink-0" />
                    <span className="truncate">{t('vpPrefix')} {cls.vice_principals?.name || t('unassigned')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                    <span className="truncate">{t('dmPrefix')} {cls.discipline_masters?.name || t('unassigned')}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Create/Edit Bottom Sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setSheetOpen(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-xl mx-auto">
              <div className="glass rounded-t-3xl p-6 border border-white/15 border-b-0"
                style={{ boxShadow: '0 -12px 50px rgba(99,102,241,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl"
                  style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                <div className="flex justify-center mb-4">
                  <div className="h-1 w-10 bg-white/20 rounded-full" />
                </div>
                <h2 className="text-xl font-black mb-5">{editingClass ? t('editClass') : t('createNewClass')}</h2>

                <form onSubmit={handleSave} className="space-y-5">
                  {/* Class ID — only for new classes */}
                  {!editingClass && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5 text-red-400" />
                        {t('classIdLabel')} <span className="text-red-400">*</span>
                      </Label>
                      <Input type="number" placeholder="e.g. 101 (must be unique)"
                        className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50"
                        value={formData.id || ''} onChange={e => setFormData({ ...formData, id: e.target.value })} required />
                      <p className="text-[11px] text-muted-foreground">{t('classIdHint')}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('classNameLabel')}</Label>
                    <Input placeholder="e.g. Form 5 Science A"
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50"
                      value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('sectorStream')}</Label>
                    <Input placeholder="e.g. Science, Arts"
                      className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50"
                      value={formData.sector || ''} onChange={e => setFormData({ ...formData, sector: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('vicePrincipalLabel')}</Label>
                      <Select value={formData.vp_id || ''} onValueChange={v => setFormData({ ...formData, vp_id: v })}>
                        <SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl">
                          <SelectValue placeholder={t('selectVP')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">{t('unassigned')}</SelectItem>
                          {vps.map(vp => <SelectItem key={vp.id} value={vp.id.toString()}>{vp.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('disciplineMasterLabel')}</Label>
                      <Select value={formData.dm_id || ''} onValueChange={v => setFormData({ ...formData, dm_id: v })}>
                        <SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl">
                          <SelectValue placeholder={t('selectDM')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">{t('unassigned')}</SelectItem>
                          {dms.map(dm => <SelectItem key={dm.id} value={dm.id.toString()}>{dm.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Subjects */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-400" /> {t('subjectsLabel')}
                      </Label>
                      <span className="text-xs text-muted-foreground">{selectedSubjects.size} {t('selectedCountLabel')}</span>
                    </div>
                    {schoolSubjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 rounded-xl bg-white/5 border border-white/10">
                        {t('noSubjectsInCatalogue')}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-3 rounded-xl bg-white/4 border border-white/8">
                        {schoolSubjects.map(s => (
                          <SubjectPill key={s.id} name={s.name}
                            checked={selectedSubjects.has(s.name)}
                            onToggle={() => setSelectedSubjects(prev => {
                              const next = new Set(prev);
                              next.has(s.name) ? next.delete(s.name) : next.add(s.name);
                              return next;
                            })} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" onClick={() => setSheetOpen(false)}
                      className="py-3.5 rounded-2xl font-bold text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all">
                      {t('cancel')}
                    </button>
                    <button type="submit" disabled={formLoading}
                      className="py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
                      {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {t('saveClass')}
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
        {deleteTarget && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setDeleteTarget(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="glass rounded-3xl p-7 border border-white/15 max-w-sm w-full"
                style={{ boxShadow: '0 16px 60px rgba(239,68,68,0.15)' }}>
                <h2 className="text-xl font-black mb-2">{t('deleteClassTitle')}</h2>
                <p className="text-sm text-muted-foreground mb-6">{t('deleteClassDesc')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDeleteTarget(null)}
                    className="py-3.5 rounded-2xl font-bold text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all">
                    {t('cancel')}
                  </button>
                  <button onClick={confirmDelete}
                    className="py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.97]"
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

export default AdminClassesPage;
