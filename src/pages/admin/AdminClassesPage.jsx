/**
 * AdminClassesPage.jsx
 * ─────────────────────
 * Manages classes. The create/edit dialog now includes a subject-picker
 * section: the admin checks which subjects from the school catalogue
 * this class will study. Selections are saved to `class_subjects`.
 */
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { School, Plus, Pencil, Trash2, Search, Loader2, Users, UserCheck, Shield, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const AdminClassesPage = () => {
  const schoolId = localStorage.getItem('schoolId');
  const { toast } = useToast();

  const [classes, setClasses]   = useState([]);
  const [vps, setVps]           = useState([]);
  const [dms, setDms]           = useState([]);
  const [schoolSubjects, setSchoolSubjects] = useState([]); // catalogue from school_subjects
  const [loading, setLoading]   = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isDialogOpen, setIsDialogOpen]     = useState(false);
  const [editingClass, setEditingClass]     = useState(null);
  const [formData, setFormData]             = useState({});
  const [selectedSubjects, setSelectedSubjects] = useState(new Set()); // subject names checked
  const [formLoading, setFormLoading]       = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [classToDelete, setClassToDelete]   = useState(null);

  useEffect(() => { fetchData(); }, [schoolId]);

  const fetchData = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*, vice_principals(name), discipline_masters(name)')
        .eq('school_id', parseInt(schoolId))
        .order('name');
      if (classError) throw classError;
      setClasses(classData || []);

      const { data: vpData }  = await supabase.from('vice_principals').select('id, name').eq('school_id', parseInt(schoolId));
      const { data: dmData }  = await supabase.from('discipline_masters').select('id, name').eq('school_id', parseInt(schoolId));
      const { data: subData } = await supabase.from('school_subjects').select('id, name').eq('school_id', parseInt(schoolId)).order('name');

      setVps(vpData || []);
      setDms(dmData || []);
      setSchoolSubjects(subData || []);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load classes.' });
    } finally { setLoading(false); }
  };

  const filteredClasses = classes.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const openDialog = async (cls = null) => {
    setEditingClass(cls);
    setFormData(cls
      ? { name: cls.name, sector: cls.sector || '', vp_id: cls.vp_id?.toString() || '', dm_id: cls.dm_id?.toString() || '' }
      : { name: '', sector: '', vp_id: '', dm_id: '' }
    );

    // Load existing subject assignments for the class being edited
    if (cls) {
      const { data } = await supabase
        .from('class_subjects')
        .select('subject')
        .eq('class_id', cls.id);
      setSelectedSubjects(new Set((data || []).map(r => r.subject)));
    } else {
      setSelectedSubjects(new Set());
    }

    setIsDialogOpen(true);
  };

  const toggleSubject = (name) => {
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleDeleteClick = (id) => { setClassToDelete(id); setDeleteConfirmOpen(true); };

  const confirmDelete = async () => {
    if (!classToDelete) return;
    try {
      const { error } = await supabase.from('classes').delete().eq('id', classToDelete);
      if (error) throw error;
      setClasses(prev => prev.filter(c => c.id !== classToDelete));
      toast({ title: 'Class Deleted' });
      setDeleteConfirmOpen(false); setClassToDelete(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'Ensure no students are assigned first.' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
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
        const { data, error } = await supabase.from('classes').insert([payload]).select().single();
        if (error) throw error;
        classId = data.id;
      }

      // ── Save subject assignments ──────────────────────────────────────────
      // Delete all existing, re-insert chosen ones
      await supabase.from('class_subjects').delete().eq('class_id', classId);
      const chosen = [...selectedSubjects];
      if (chosen.length > 0) {
        const rows = chosen.map(subject => ({
          class_id: classId,
          school_id: parseInt(schoolId),
          subject,
          is_obligatory: true, // default; VP can change via Attribute Subjects
        }));
        const { error: subErr } = await supabase.from('class_subjects').insert(rows);
        if (subErr) throw subErr;
      }

      toast({ title: 'Success', description: `Class ${editingClass ? 'updated' : 'created'} with ${chosen.length} subject(s).`, className: 'bg-green-500/10 border-green-500/50 text-green-500' });
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } finally { setFormLoading(false); }
  };

  return (
    <>
      <Helmet><title>Class Management - Admin</title></Helmet>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Class Management</h1>
            <p className="text-muted-foreground">Manage classes, sectors, staff assignments and subjects.</p>
          </div>
          <Button onClick={() => openDialog()} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Add New Class
          </Button>
        </div>

        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Classes Directory</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search classes..." className="pl-8 bg-background/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : filteredClasses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><School className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No classes found.</p></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredClasses.map(cls => (
                  <div key={cls.id} className="group p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{cls.name}</h3>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(cls)}><Pencil className="w-4 h-4 text-indigo-400" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteClick(cls.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                      </div>
                    </div>
                    <Badge variant="secondary" className="mb-4">{cls.sector || 'General'}</Badge>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserCheck className="w-4 h-4 text-pink-500" /><span>VP: {cls.vice_principals?.name || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Shield className="w-4 h-4 text-orange-500" /><span>DM: {cls.discipline_masters?.name || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClass ? 'Edit Class' : 'Create New Class'}</DialogTitle>
              <DialogDescription>Configure class details, staff assignments, and subjects.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label>Class Name</Label>
                <Input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Form 5 Science A" required />
              </div>
              <div className="grid gap-2">
                <Label>Sector / Stream</Label>
                <Input value={formData.sector || ''} onChange={e => setFormData({ ...formData, sector: e.target.value })} placeholder="e.g. Science, Arts" />
              </div>
              <div className="grid gap-2">
                <Label>Assigned Vice Principal</Label>
                <Select value={formData.vp_id || ''} onValueChange={val => setFormData({ ...formData, vp_id: val })}>
                  <SelectTrigger><SelectValue placeholder="Select VP" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {vps.map(vp => <SelectItem key={vp.id} value={vp.id.toString()}>{vp.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assigned Discipline Master</Label>
                <Select value={formData.dm_id || ''} onValueChange={val => setFormData({ ...formData, dm_id: val })}>
                  <SelectTrigger><SelectValue placeholder="Select DM" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {dms.map(dm => <SelectItem key={dm.id} value={dm.id.toString()}>{dm.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* ── Subject checkboxes ─────────────────────────────────── */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-400" /> Class Subjects</Label>
                  <span className="text-xs text-muted-foreground">{selectedSubjects.size} selected</span>
                </div>
                {schoolSubjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 rounded-lg bg-white/5 border border-white/10">
                    No school subjects defined yet. Go to the dashboard and click <strong>Manage Subjects</strong> to add them first.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 rounded-lg bg-white/5 border border-white/10">
                    {schoolSubjects.map(s => {
                      const checked = selectedSubjects.has(s.name);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSubject(s.name)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors border
                            ${checked ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-transparent border-white/10 text-muted-foreground hover:bg-white/5'}`}
                        >
                          <div className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center
                            ${checked ? 'bg-indigo-500 border-indigo-500' : 'border-muted-foreground/40'}`}>
                            {checked && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <span className="truncate">{s.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={formLoading} className="bg-indigo-600 text-white">
                  {formLoading ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : null} Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>Are you sure? This will fail if students are assigned to this class.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AdminClassesPage;
