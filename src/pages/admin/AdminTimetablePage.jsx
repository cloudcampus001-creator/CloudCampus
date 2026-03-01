/**
 * AdminTimetablePage.jsx
 * src/pages/admin/AdminTimetablePage.jsx
 *
 * When a class is selected, the "Add Slot" dialog loads that class's
 * assigned subjects from `class_subjects` and shows them as a searchable
 * scrollable dropdown instead of a plain Select.
 * Same treatment for the Teacher picker.
 */
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { CalendarClock, Plus, Trash2, Loader2, User } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import SearchableSelect from '@/components/SearchableSelect';

const AdminTimetablePage = () => {
  const schoolId = localStorage.getItem('schoolId');
  const { toast } = useToast();

  const [classes,        setClasses]        = useState([]);
  const [teachers,       setTeachers]       = useState([]);
  const [selectedClass,  setSelectedClass]  = useState(null);
  const [timetable,      setTimetable]      = useState([]);
  const [classSubjects,  setClassSubjects]  = useState([]);
  const [loading,        setLoading]        = useState(false);

  const [isDialogOpen,      setIsDialogOpen]      = useState(false);
  const [slotData,          setSlotData]          = useState({});
  const [saving,            setSaving]            = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [slotToDelete,      setSlotToDelete]      = useState(null);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // ── Load classes + teachers once ────────────────────────────────────────
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!schoolId) return;
      const [{ data: cls }, { data: tch }] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', parseInt(schoolId)).order('name'),
        supabase.from('teachers').select('id, name').eq('school_id', parseInt(schoolId)).order('name'),
      ]);
      setClasses(cls || []);
      setTeachers(tch || []);
    };
    fetchMetadata();
  }, [schoolId]);

  // ── When class changes: load timetable + subjects ────────────────────────
  useEffect(() => {
    if (selectedClass) {
      fetchTimetable();
      fetchClassSubjects();
    } else {
      setTimetable([]);
      setClassSubjects([]);
    }
  }, [selectedClass]);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('timetables')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('school_id', parseInt(schoolId));
      if (error) throw error;
      setTimetable(data || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load timetable.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchClassSubjects = async () => {
    const { data } = await supabase
      .from('class_subjects')
      .select('subject')
      .eq('class_id', selectedClass)
      .order('subject');
    setClassSubjects((data || []).map(r => r.subject));
  };

  const handleAddSlot = (day) => {
    setSlotData({ day_of_week: day, start_time: '08:00', end_time: '09:00', teacher_id: '', subject: '' });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id) => { setSlotToDelete(id); setDeleteConfirmOpen(true); };

  const confirmDelete = async () => {
    if (!slotToDelete) return;
    try {
      const { error } = await supabase.from('timetables').delete().eq('id', slotToDelete);
      if (error) throw error;
      setTimetable(prev => prev.filter(t => t.id !== slotToDelete));
      setDeleteConfirmOpen(false);
      setSlotToDelete(null);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete slot.' });
    }
  };

  const handleSaveSlot = async (e) => {
    e.preventDefault();
    if (!slotData.teacher_id) {
      toast({ variant: 'destructive', title: 'Missing teacher', description: 'Please select a teacher.' });
      return;
    }
    if (!slotData.subject) {
      toast({ variant: 'destructive', title: 'Missing subject', description: 'Please select a subject.' });
      return;
    }

    setSaving(true);
    try {
      const teacher = teachers.find(t => t.id.toString() === slotData.teacher_id);
      const payload = {
        school_id:    parseInt(schoolId),
        class_id:     parseInt(selectedClass),
        teacher_id:   slotData.teacher_id,
        teacher_name: teacher?.name || 'Unknown',
        subject:      slotData.subject,
        day_of_week:  slotData.day_of_week,
        start_time:   slotData.start_time,
        end_time:     slotData.end_time,
      };
      const { data, error } = await supabase.from('timetables').insert([payload]).select();
      if (error) throw error;
      setTimetable(prev => [...prev, data[0]]);
      setIsDialogOpen(false);
      toast({ title: 'Slot added', description: `${slotData.subject} on ${slotData.day_of_week} saved.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const getSlotsForDay = (day) =>
    timetable.filter(t => t.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));

  // ── Shape items for SearchableSelect ─────────────────────────────────────
  const subjectItems  = classSubjects.map(s => ({ value: s, label: s }));
  const teacherItems  = teachers.map(t => ({ value: t.id.toString(), label: t.name }));

  return (
    <>
      <Helmet><title>Timetable Management - Admin</title></Helmet>

      <div className="space-y-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Timetables</h1>
            <p className="text-muted-foreground">Manage class schedules and teacher assignments.</p>
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedClass?.toString()} onValueChange={val => setSelectedClass(parseInt(val))}>
              <SelectTrigger className="bg-background/60 border-indigo-500/30">
                <SelectValue placeholder="Select a class to manage" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* No class selected */}
        {!selectedClass ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground min-h-[400px] glass rounded-xl">
            <CalendarClock className="w-16 h-16 mb-4 opacity-20" />
            <p>Select a class above to view or edit its timetable.</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {/* Subject chips */}
            {classSubjects.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground mr-1">Subjects in this class:</span>
                {classSubjects.map(s => (
                  <Badge key={s} variant="outline" className="text-indigo-400 border-indigo-500/30 bg-indigo-500/10 text-xs">{s}</Badge>
                ))}
              </div>
            )}

            {/* Weekly grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
              {days.map(day => (
                <div key={day} className="min-w-[220px] md:min-w-0">
                  <div className="bg-indigo-500/10 text-indigo-400 font-bold text-center py-2 rounded-t-lg border-t border-x border-indigo-500/20">
                    {day}
                  </div>
                  <div className="bg-card/30 border border-white/10 rounded-b-lg min-h-[500px] p-2 space-y-2">
                    {getSlotsForDay(day).map(slot => (
                      <div key={slot.id} className="group relative p-3 bg-background/50 hover:bg-background/80 border border-white/5 rounded-lg transition-all">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="text-[10px]">
                            {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                          </Badge>
                          <Button
                            variant="ghost" size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 -mr-1 -mt-1"
                            onClick={() => handleDeleteClick(slot.id)}
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </Button>
                        </div>
                        <div className="mt-2 font-bold text-sm text-indigo-300">{slot.subject}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" /> {slot.teacher_name}
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      className="w-full border border-dashed border-white/10 hover:border-indigo-500/50 text-muted-foreground hover:text-indigo-400 mt-2"
                      onClick={() => handleAddSlot(day)}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Slot
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Add Slot Dialog ──────────────────────────────────────────────── */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Schedule Slot</DialogTitle>
              <DialogDescription>
                {slotData.day_of_week} — {classes.find(c => c.id === selectedClass)?.name}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveSlot} className="space-y-4 py-2">
              {/* Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={slotData.start_time || '08:00'}
                    onChange={e => setSlotData(p => ({ ...p, start_time: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={slotData.end_time || '09:00'}
                    onChange={e => setSlotData(p => ({ ...p, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Subject — searchable dropdown from class_subjects */}
              <div className="space-y-2">
                <Label>Subject</Label>
                {classSubjects.length === 0 ? (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-sm">
                    No subjects assigned to this class yet. Edit the class in Class Management to add subjects first.
                  </div>
                ) : (
                  <SearchableSelect
                    items={subjectItems}
                    value={slotData.subject || ''}
                    onChange={val => setSlotData(p => ({ ...p, subject: val }))}
                    placeholder="Search & select subject…"
                    searchPlaceholder="Type subject name…"
                  />
                )}
              </div>

              {/* Teacher — searchable dropdown */}
              <div className="space-y-2">
                <Label>Teacher</Label>
                <SearchableSelect
                  items={teacherItems}
                  value={slotData.teacher_id || ''}
                  onChange={val => setSlotData(p => ({ ...p, teacher_id: val }))}
                  placeholder="Search & select teacher…"
                  searchPlaceholder="Type teacher name…"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || classSubjects.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {saving && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                  Save Slot
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>Remove this time slot? This cannot be undone.</DialogDescription>
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

export default AdminTimetablePage;
