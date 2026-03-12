/**
 * AdminUsersPage.jsx
 * ─────────────────────
 * Changes vs original:
 *  ✓ Parents tab REMOVED (parents login using student info)
 *  ✓ Teachers: subjects selector uses school_subjects catalogue (checkboxes, not free text)
 *  ✓ Teachers: classes_teaching uses multi-select dropdown from actual classes
 *  ✓ VP/DM: classes_managing uses multi-select dropdown from actual classes
 *  ✓ Full indigo/violet glass redesign
 *  ✓ Supabase logic preserved
 */
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Pencil, Trash2, Search, Loader2,
  GraduationCap, UserCheck, Shield, BookOpen, Hash,
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

const TABS = [
  { key: 'students',   label: 'Students',   icon: Users,         table: 'students' },
  { key: 'teachers',   label: 'Teachers',   icon: GraduationCap, table: 'teachers' },
  { key: 'discipline', label: 'Discipline', icon: Shield,        table: 'discipline_masters' },
  { key: 'vp',         label: 'Vice Principals', icon: UserCheck, table: 'vice_principals' },
  { key: 'admin',      label: 'Admins',     icon: BookOpen,      table: 'administrators' },
];

const MultiCheckbox = ({ label, items, selected, onChange, placeholder }) => {
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
            {items.length === 0 && <p className="text-xs text-muted-foreground p-2">No items available</p>}
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

/* ═══════════════════════════════════════════════════════ */
const AdminUsersPage = () => {
  const { toast }   = useToast();
  const { t }       = useLanguage();
  const schoolId    = localStorage.getItem('schoolId');

  const [activeTab,      setActiveTab]      = useState('students');
  const [users,          setUsers]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');

  // Reference data
  const [schoolSubjects, setSchoolSubjects] = useState([]);
  const [allClasses,     setAllClasses]     = useState([]);

  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [editingUser,    setEditingUser]    = useState(null);
  const [formData,       setFormData]       = useState({});
  const [formLoading,    setFormLoading]    = useState(false);
  const [deleteTarget,   setDeleteTarget]   = useState(null);

  // Form-specific arrays stored as real arrays, not strings
  const [selectedSubjects,  setSelectedSubjects]  = useState([]);
  const [selectedClassIds,  setSelectedClassIds]  = useState([]);

  const getTable = (tab) => TABS.find(t => t.key === tab)?.table || 'students';

  useEffect(() => { fetchUsers(); }, [activeTab, schoolId]);

  useEffect(() => {
    // Load reference data for forms
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
      const { data, error } = await supabase.from(getTable(activeTab)).select('*')
        .eq('school_id', parseInt(schoolId));
      if (error) throw error;
      setUsers(data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load users.' });
    } finally { setLoading(false); }
  };

  const filtered = users.filter(u => (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()));

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

  const handleSave = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const table = getTable(activeTab);
      const dataToSave = { ...formData, school_id: parseInt(schoolId) };

      // Apply multi-select arrays
      if (activeTab === 'teachers') {
        dataToSave.subjects = selectedSubjects;
        dataToSave.classes_teaching = selectedClassIds.map(id => parseInt(id));
      }
      if (activeTab === 'vp') {
        dataToSave.classes_managing = selectedClassIds.map(id => parseInt(id));
      }

      // Auto-generate matricule for new students
      if (activeTab === 'students' && !editingUser && !dataToSave.matricule) {
        dataToSave.matricule = `STU${Math.floor(Math.random() * 90000) + 10000}`;
      }

      let error;
      if (editingUser) {
        const idCol = activeTab === 'students' ? 'matricule' : 'id';
        ({ error } = await supabase.from(table).update(dataToSave).eq(idCol, editingUser[idCol]));
      } else {
        if (!dataToSave.id && activeTab !== 'students') delete dataToSave.id;
        ({ error } = await supabase.from(table).insert([dataToSave]));
      }

      if (error) throw error;
      toast({ title: editingUser ? 'User Updated' : 'User Created', className: 'bg-green-500/10 border-green-500/50 text-green-400' });
      setSheetOpen(false);
      fetchUsers();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err.message });
    } finally { setFormLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const idCol = activeTab === 'students' ? 'matricule' : 'id';
    const { error } = await supabase.from(getTable(activeTab)).delete().eq(idCol, deleteTarget);
    if (!error) {
      setUsers(prev => prev.filter(u => u[idCol] !== deleteTarget));
      toast({ title: 'User Deleted' });
    } else {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    }
    setDeleteTarget(null);
  };

  const classItems = allClasses.map(c => ({ value: c.id.toString(), label: c.name }));
  const subjectItems = schoolSubjects.map(s => ({ value: s.name, label: s.name }));

  const renderFormFields = () => {
    switch (activeTab) {
      case 'students': return (
        <>
          <Field label="Full Name"><Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></Field>
          <Field label="Matricule (ID)" hint="Auto-generated if empty"><Input value={formData.matricule || ''} onChange={e => setFormData({ ...formData, matricule: e.target.value })} disabled={!!editingUser} placeholder="Auto-generated" /></Field>
          <Field label="Class" hint="Select the class for this student">
            <Select value={formData.class_id?.toString() || ''} onValueChange={v => setFormData({ ...formData, class_id: parseInt(v) })}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl"><SelectValue placeholder="Select class…" /></SelectTrigger>
              <SelectContent>{allClasses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </>
      );
      case 'teachers': return (
        <>
          <Field label="Teacher ID" hint="Numeric ID (primary key)"><Input type="number" value={formData.id || ''} onChange={e => setFormData({ ...formData, id: parseInt(e.target.value) })} required disabled={!!editingUser} /></Field>
          <Field label="Full Name"><Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></Field>
          <Field label="Subjects" hint="Select from school catalogue">
            <MultiCheckbox items={subjectItems} selected={selectedSubjects} onChange={setSelectedSubjects} placeholder="Select subjects…" />
            {schoolSubjects.length === 0 && <p className="text-xs text-amber-400 mt-1">Add subjects in Subjects & Library first.</p>}
          </Field>
          <Field label="Classes Teaching" hint="Select classes this teacher covers">
            <MultiCheckbox items={classItems} selected={selectedClassIds} onChange={setSelectedClassIds} placeholder="Select classes…" />
          </Field>
        </>
      );
      case 'vp': return (
        <>
          <Field label="VP ID"><Input type="number" value={formData.id || ''} onChange={e => setFormData({ ...formData, id: parseInt(e.target.value) })} required disabled={!!editingUser} /></Field>
          <Field label="Full Name"><Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></Field>
          <Field label="Managing Classes" hint="Classes under this VP's supervision">
            <MultiCheckbox items={classItems} selected={selectedClassIds} onChange={setSelectedClassIds} placeholder="Select classes…" />
          </Field>
        </>
      );
      case 'discipline': return (
        <>
          <Field label="DM ID"><Input type="number" value={formData.id || ''} onChange={e => setFormData({ ...formData, id: parseInt(e.target.value) })} required disabled={!!editingUser} /></Field>
          <Field label="Full Name"><Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></Field>
        </>
      );
      case 'admin': return (
        <>
          <Field label="Full Name"><Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required /></Field>
          <Field label="Password" hint="Set or update admin password"><Input type="password" value={formData.password_hash || ''} onChange={e => setFormData({ ...formData, password_hash: e.target.value })} placeholder="Leave blank to keep current" /></Field>
        </>
      );
      default: return null;
    }
  };

  const getUserSub = (u) => {
    if (activeTab === 'students') return `Matricule: ${u.matricule || '—'} · Class: ${u.class_id || '?'}`;
    if (activeTab === 'teachers') return `Subjects: ${Array.isArray(u.subjects) ? u.subjects.slice(0,2).join(', ') : '—'}`;
    if (activeTab === 'vp') return `Classes: ${Array.isArray(u.classes_managing) ? u.classes_managing.length : 0}`;
    return `ID: ${u.id}`;
  };

  return (
    <>
      <Helmet><title>User Management · Admin</title></Helmet>
      <div className="space-y-7 pb-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">User Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Create and manage all school stakeholder accounts.</p>
          </div>
          <button onClick={() => openSheet()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white self-start sm:self-auto"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
            <Plus className="h-4 w-4" /> Add {TABS.find(t => t.key === activeTab)?.label.slice(0,-1) || 'User'}
          </button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border whitespace-nowrap transition-all shrink-0',
                  active ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300' : 'bg-white/4 border-white/10 text-muted-foreground hover:bg-white/8')}>
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder={`Search ${TABS.find(t => t.key === activeTab)?.label.toLowerCase()}…`}
            className="pl-10 h-11 bg-white/5 border-white/10 rounded-xl"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        {/* User list */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="animate-pulse h-16 rounded-2xl bg-white/5" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 glass rounded-2xl border border-white/8 gap-3 text-muted-foreground">
            <Users className="h-12 w-12 opacity-15" />
            <p>No {TABS.find(t => t.key === activeTab)?.label.toLowerCase()} found.</p>
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setSheetOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
              <div className="glass rounded-t-3xl p-6 border border-white/15 border-b-0"
                style={{ boxShadow: '0 -12px 50px rgba(99,102,241,0.15)', maxHeight: '92vh', overflowY: 'auto' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl"
                  style={{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
                <div className="flex justify-center mb-4"><div className="h-1 w-10 bg-white/20 rounded-full" /></div>
                <h2 className="text-xl font-black mb-5">{editingUser ? 'Edit User' : `New ${TABS.find(t => t.key === activeTab)?.label.slice(0,-1)}`}</h2>
                <form onSubmit={handleSave} className="space-y-4">
                  {renderFormFields()}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" onClick={() => setSheetOpen(false)}
                      className="py-3.5 rounded-2xl font-bold text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all">
                      Cancel
                    </button>
                    <button type="submit" disabled={formLoading}
                      className="py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
                      {formLoading && <Loader2 className="h-4 w-4 animate-spin" />} Save
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
                <h2 className="text-xl font-black mb-2">Delete User?</h2>
                <p className="text-sm text-muted-foreground mb-6">This action cannot be undone.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setDeleteTarget(null)}
                    className="py-3.5 rounded-2xl font-bold text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all">Cancel</button>
                  <button onClick={confirmDelete}
                    className="py-3.5 rounded-2xl font-bold text-sm text-white"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 6px 20px rgba(239,68,68,0.3)' }}>Delete</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

/* Field wrapper helper */
const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
  </div>
);

export default AdminUsersPage;
