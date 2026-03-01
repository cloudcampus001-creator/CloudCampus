import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Users, Plus, Pencil, Trash2, Search, Loader2, Shield, GraduationCap, User, BookOpen
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

const AdminUsersPage = () => {
  const schoolId = localStorage.getItem('schoolId');
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('students');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Helper to get table name from tab
  const getTableName = (tab) => {
    switch(tab) {
      case 'students': return 'students';
      case 'teachers': return 'teachers';
      case 'parents': return 'parents';
      case 'discipline': return 'discipline_masters';
      case 'vp': return 'vice_principals';
      case 'admin': return 'administrators';
      default: return 'students';
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [activeTab, schoolId]);

  const fetchUsers = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const table = getTableName(activeTab);
      let query = supabase.from(table).select('*').eq('school_id', parseInt(schoolId));
      
      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleAdd = () => {
    setEditingUser(null);
    setFormData({});
    setIsDialogOpen(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    // Flatten arrays for inputs if needed
    const data = { ...user };
    if (Array.isArray(data.subjects)) data.subjects = data.subjects.join(', ');
    if (Array.isArray(data.classes_teaching)) data.classes_teaching = data.classes_teaching.join(', ');
    if (Array.isArray(data.classes_managing)) data.classes_managing = data.classes_managing.join(', ');
    if (Array.isArray(data.student_matricules)) data.student_matricules = data.student_matricules.join(', ');
    
    setFormData(data);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id) => {
    setUserToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      const table = getTableName(activeTab);
      // Use correct ID column (matricule for students, id for others)
      const { error } = await supabase.from(table).delete().eq(activeTab === 'students' ? 'matricule' : 'id', userToDelete);
      
      if (error) throw error;
      
      toast({ title: 'User Deleted', description: 'The user has been removed.' });
      setUsers(prev => prev.filter(u => (activeTab === 'students' ? u.matricule : u.id) !== userToDelete));
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      const table = getTableName(activeTab);
      const dataToSave = { ...formData, school_id: parseInt(schoolId) };

      // Process arrays
      if (typeof dataToSave.subjects === 'string') {
        dataToSave.subjects = dataToSave.subjects.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (typeof dataToSave.classes_teaching === 'string') {
        dataToSave.classes_teaching = dataToSave.classes_teaching.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      }
      if (typeof dataToSave.classes_managing === 'string') {
        dataToSave.classes_managing = dataToSave.classes_managing.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      }
      if (typeof dataToSave.student_matricules === 'string') {
        dataToSave.student_matricules = dataToSave.student_matricules.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      // Handle specific field requirements
      if (activeTab === 'students' && !editingUser) {
         // Ensure matricule is unique if new
         // In a real app, backend handles generation, but we'll trust input or auto-generate simple one
         if (!dataToSave.matricule) dataToSave.matricule = `STU${Math.floor(Math.random()*10000)}`;
      }

      let error;
      if (editingUser) {
        // Update
        const idCol = activeTab === 'students' ? 'matricule' : 'id';
        const { error: err } = await supabase.from(table).update(dataToSave).eq(idCol, editingUser[idCol]);
        error = err;
      } else {
        // Insert
        // For integer IDs (except students), we let DB handle serial or provide one? 
        // Schema implies serial for most 'id' columns. But let's check constraints. 
        // Teachers/DMs/VPs use 'id integer'. If it's not serial, we might need to provide one.
        // Assuming the user inserts IDs for simplicity if auto-increment isn't set up, OR random ID.
        // Let's remove 'id' from dataToSave if it's empty to let DB try to autoincrement
        if (!dataToSave.id) delete dataToSave.id;
        
        const { error: err } = await supabase.from(table).insert([dataToSave]);
        error = err;
      }

      if (error) throw error;

      toast({ 
        title: editingUser ? 'User Updated' : 'User Created', 
        description: `Successfully saved details for ${dataToSave.name}.`,
        className: "bg-green-500/10 border-green-500/50 text-green-500"
      });
      
      setIsDialogOpen(false);
      fetchUsers();

    } catch (error) {
      console.error('Save error:', error);
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } finally {
      setFormLoading(false);
    }
  };

  const renderFormFields = () => {
    switch(activeTab) {
      case 'students':
        return (
          <>
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Matricule (ID)</Label>
              <Input value={formData.matricule || ''} onChange={e => setFormData({...formData, matricule: e.target.value})} disabled={!!editingUser} placeholder="Auto-generated if empty" />
            </div>
            <div className="grid gap-2">
              <Label>Class ID</Label>
              <Input type="number" value={formData.class_id || ''} onChange={e => setFormData({...formData, class_id: parseInt(e.target.value)})} required />
            </div>
          </>
        );
      case 'teachers':
        return (
          <>
            <div className="grid gap-2">
              <Label>Teacher ID</Label>
              <Input type="number" value={formData.id || ''} onChange={e => setFormData({...formData, id: parseInt(e.target.value)})} required />
            </div>
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Subjects (comma separated)</Label>
              <Input value={formData.subjects || ''} onChange={e => setFormData({...formData, subjects: e.target.value})} placeholder="Math, Physics" />
            </div>
            <div className="grid gap-2">
              <Label>Classes Teaching IDs (comma separated)</Label>
              <Input value={formData.classes_teaching || ''} onChange={e => setFormData({...formData, classes_teaching: e.target.value})} placeholder="1, 2, 3" />
            </div>
          </>
        );
      case 'parents':
        return (
          <>
            <div className="grid gap-2">
              <Label>Parent Name</Label>
              <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Student Matricules (comma separated)</Label>
              <Input value={formData.student_matricules || ''} onChange={e => setFormData({...formData, student_matricules: e.target.value})} placeholder="STU123, STU456" />
            </div>
          </>
        );
      case 'vp':
        return (
          <>
            <div className="grid gap-2">
              <Label>VP's ID</Label>
              <Input type="number" value={formData.id || ''} onChange={e => setFormData({...formData, id: parseInt(e.target.value)})} required />
            </div>
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Managing Class IDs (comma separated)</Label>
              <Input value={formData.classes_managing || ''} onChange={e => setFormData({...formData, classes_managing: e.target.value})} placeholder="1, 2, 3" />
            </div>
          </>
        );
       case 'discipline':
        return (
          <>
            <div className="grid gap-2">
              <Label>DM's ID</Label>
              <Input type="number" value={formData.id || ''} onChange={e => setFormData({...formData, id: parseInt(e.target.value)})} required />
            </div>
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
          </>
        );
       case 'admin':
        return (
          <>
            <div className="grid gap-2">
              <Label>Full Name</Label>
              <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
            {activeTab === 'admin' && (
                <div className="grid gap-2">
                <Label>Password Hash (Direct Set)</Label>
                <Input value={formData.password_hash || ''} onChange={e => setFormData({...formData, password_hash: e.target.value})} placeholder="Secret123" />
                </div>
            )}
          </>
        );
      default: return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>User Management - Admin</title>
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Create and manage accounts for all school stakeholders.</p>
          </div>
          <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Add New {activeTab.slice(0, -1)}
          </Button>
        </div>

        <Tabs defaultValue="students" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-8 bg-muted/30 p-1 h-auto">
            <TabsTrigger value="students" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">Students</TabsTrigger>
            <TabsTrigger value="teachers" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">Teachers</TabsTrigger>
            <TabsTrigger value="parents" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">Parents</TabsTrigger>
            <TabsTrigger value="discipline" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">Discipline</TabsTrigger>
            <TabsTrigger value="vp" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">V. Principals</TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">Admins</TabsTrigger>
          </TabsList>

          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="capitalize">{activeTab} Directory</CardTitle>
                <form onSubmit={handleSearch} className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder={`Search ${activeTab}...`} 
                    className="pl-8 bg-background/50" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </form>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No {activeTab} found.</p>
                </div>
              ) : (
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm text-left">
                    <thead className="[&_tr]:border-b [&_tr]:border-white/10">
                      <tr className="border-b border-white/10">
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">ID/Name</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Details</th>
                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id || user.matricule} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                          <td className="p-4 align-middle">
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{user.matricule || `ID: ${user.id}`}</div>
                          </td>
                          <td className="p-4 align-middle">
                            {activeTab === 'students' && <Badge variant="outline">Class: {user.class_id}</Badge>}
                            {activeTab === 'teachers' && (
                              <div className="space-y-1">
                                <div className="text-xs">Subjects: {Array.isArray(user.subjects) ? user.subjects.slice(0,3).join(', ') : user.subjects}</div>
                              </div>
                            )}
                            {activeTab === 'parents' && (
                                <div className="text-xs text-muted-foreground">Children: {Array.isArray(user.student_matricules) ? user.student_matricules.length : 0}</div>
                            )}
                          </td>
                          <td className="p-4 align-middle text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                                <Pencil className="w-4 h-4 text-indigo-400" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(user.id || user.matricule)}>
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
              <DialogDescription>
                {activeTab.slice(0, -1).toUpperCase()} Details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 py-4">
              {renderFormFields()}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={formLoading} className="bg-indigo-600 text-white">
                  {formLoading ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this user? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={confirmDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AdminUsersPage;