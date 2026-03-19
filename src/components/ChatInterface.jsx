import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Paperclip, MoreVertical, Search, ChevronLeft, 
  MessageSquare, Plus, User, Loader2, FileText, CheckCheck, X,
  RefreshCcw, Phone, Video, Smile
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ChatInterface = ({ currentUserRole, currentUserId, currentUserName, relatedContext }) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  
  // -- VIEW STATE --
  const [activeConv, setActiveConv] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // -- DATA STATE --
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  
  // -- UI STATE --
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [startingChat, setStartingChat] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  // -- FILE UPLOAD --
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // -- REFS --
  const messagesEndRef = useRef(null);
  const chatChannelRef = useRef(null);
  const inputRef = useRef(null);

  // =================================================================================
  // 1. INITIALIZATION & REALTIME
  // =================================================================================
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    fetchConversations();
    
    const channel = supabase
      .channel('public:chat_messages_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        handleRealtimeMessage(payload.new);
      })
      .subscribe();

    chatChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, currentUserRole]);

  const handleRealtimeMessage = (newMsg) => {
    setActiveConv(current => {
      if (current && current.id === newMsg.conversation_id) {
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, { ...newMsg, chat_attachments: [] }];
        });
        setTimeout(scrollToBottom, 100);
      }
      return current;
    });

    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === newMsg.conversation_id);
      if (idx === -1) { fetchConversations(); return prev; }
      const updated = { ...prev[idx], last_message_at: newMsg.created_at, last_message_preview: newMsg.content };
      const newList = [...prev];
      newList.splice(idx, 1);
      return [updated, ...newList];
    });
  };

  // =================================================================================
  // 2. DATA FETCHING
  // =================================================================================
  const fetchConversations = async () => {
    if (!currentUserId) return;
    try {
      const userIdentifier = `${currentUserRole}:${currentUserId}`;
      const { data: convs, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .contains('participant_ids', [userIdentifier])
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const enriched = await Promise.all(convs.map(async (conv) => {
        if (conv.is_group) return conv;
        const otherIdStr = conv.participant_ids.find(id => id !== userIdentifier);
        if (!otherIdStr) return { ...conv, display_name: 'Saved Messages' };
        const [otherRole, otherId] = otherIdStr.split(':');
        const { data: participantData } = await supabase
          .from('chat_participants')
          .select('user_name')
          .eq('conversation_id', conv.id)
          .eq('user_id', otherId)
          .eq('user_role', otherRole)
          .limit(1)
          .maybeSingle();
        return {
          ...conv,
          display_name: participantData?.user_name || 'Unknown User',
          other_role: otherRole,
          initial: (participantData?.user_name || '?')[0]
        };
      }));

      setConversations(enriched);
    } catch (err) {
      console.error('Fetch convos error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    if (!currentUserId) {
      toast({ title: "Error", description: "User session not found. Please refresh." });
      return;
    }
    const schoolId = relatedContext?.schoolId;
    const classId  = relatedContext?.classId;
    if (!schoolId || !Number.isFinite(schoolId) || schoolId <= 0) {
      toast({ variant: 'destructive', title: "Error", description: "School not identified. Please log out and log in again." });
      return;
    }
    setContactsLoading(true);
    try {
      // Primary: call the RPC (works for most roles)
      const { data: rpcData, error } = await supabase.rpc('get_chat_contacts', {
        p_school_id: schoolId,
        p_user_role: currentUserRole,
        p_user_id:   String(currentUserId),
      });
      if (error) throw error;
      let contacts = rpcData || [];

      // ── Parent fallback: always build the full contact list directly ──────
      // The RPC may return partial/empty results depending on class assignment.
      // For parents we always guarantee: Admins + VP in charge + DM in charge + Teachers of their class.
      if (currentUserRole === 'parent') {
        const hasAdmin   = contacts.some(c => c.contact_role === 'administrator');
        const hasTeacher = contacts.some(c => c.contact_role === 'teacher');

        // Only run fallback when the RPC came back missing critical contacts
        if (!hasAdmin || !hasTeacher) {
          const builtContacts = [];

          // 1. Administrators (school-wide)
          const { data: admins } = await supabase
            .from('administrators').select('id, name').eq('school_id', schoolId);
          (admins || []).forEach(a => builtContacts.push({
            contact_id: String(a.id), contact_role: 'administrator',
            display_name: a.name, group_name: 'Administration',
            sort_order: 1, my_display_name: currentUserName || 'Parent',
          }));

          // 2. VP and DM in charge of the class
          if (classId) {
            const { data: cls } = await supabase
              .from('classes').select('vp_id, dm_id').eq('id', classId).maybeSingle();

            if (cls?.vp_id) {
              const { data: vp } = await supabase
                .from('vice_principals').select('id, name').eq('id', cls.vp_id).maybeSingle();
              if (vp) builtContacts.push({
                contact_id: String(vp.id), contact_role: 'vice_principal',
                display_name: vp.name, group_name: 'Administration',
                sort_order: 2, my_display_name: currentUserName || 'Parent',
              });
            }

            if (cls?.dm_id) {
              const { data: dm } = await supabase
                .from('discipline_masters').select('id, name').eq('id', cls.dm_id).maybeSingle();
              if (dm) builtContacts.push({
                contact_id: String(dm.id), contact_role: 'discipline',
                display_name: dm.name, group_name: 'Administration',
                sort_order: 3, my_display_name: currentUserName || 'Parent',
              });
            }

            // 3. Teachers of the class (deduplicated)
            const { data: timetableRows } = await supabase
              .from('timetables').select('teacher_id, teachers(id, name), subject')
              .eq('class_id', classId).eq('school_id', schoolId);

            const seenTeachers = new Set();
            (timetableRows || []).forEach(row => {
              const teacher = row.teachers;
              if (!teacher || seenTeachers.has(teacher.id)) return;
              seenTeachers.add(teacher.id);
              builtContacts.push({
                contact_id: String(teacher.id), contact_role: 'teacher',
                display_name: teacher.name, group_name: 'Teachers',
                sort_order: 4, my_display_name: currentUserName || 'Parent',
              });
            });
          }

          // Merge: prefer RPC results when available, fill gaps from direct queries
          const rpcIds = new Set(contacts.map(c => `${c.contact_role}:${c.contact_id}`));
          const merged = [
            ...contacts,
            ...builtContacts.filter(c => !rpcIds.has(`${c.contact_role}:${c.contact_id}`)),
          ];
          contacts = merged;
        }
      }

      setContacts(contacts);
    } catch (err) {
      console.error("Contacts fetch error:", err);
      toast({ variant: 'destructive', title: "Error", description: "Could not load contacts." });
    } finally {
      setContactsLoading(false);
    }
  };

  const loadMessages = async (convId) => {
    const { data } = await supabase
      .from('chat_messages')
      .select(`*, chat_attachments(*)`)
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setTimeout(scrollToBottom, 100);
  };

  // =================================================================================
  // 3. ACTIONS
  // =================================================================================
  const handleStartChat = async (contact) => {
    if (startingChat) return;
    setStartingChat(true);
    try {
      const { data: convId, error } = await supabase.rpc('get_or_create_direct_conversation_v2', {
        p_user1_id: String(currentUserId),
        p_user1_role: currentUserRole,
        p_user1_display_name: contact.my_display_name || currentUserName || 'User',
        p_user2_id: contact.contact_id,
        p_user2_role: contact.contact_role,
        p_user2_display_name: contact.display_name
      });
      if (error) throw error;
      setShowNewChat(false);
      const existingConv = conversations.find(c => c.id === convId);
      if (existingConv) {
        setActiveConv(existingConv);
        loadMessages(convId);
      } else {
        const newConv = {
          id: convId,
          display_name: contact.display_name,
          initial: contact.display_name[0],
          last_message_at: new Date().toISOString(),
          participant_ids: [`${currentUserRole}:${currentUserId}`, `${contact.contact_role}:${contact.contact_id}`]
        };
        setConversations(prev => [newConv, ...prev]);
        setActiveConv(newConv);
        loadMessages(convId);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: "Error", description: "Failed to start conversation." });
    } finally {
      setStartingChat(false);
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!messageInput.trim() && !selectedFile) || !activeConv) return;
    setSending(true);
    try {
      const { data: msg, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: activeConv.id,
          sender_id: String(currentUserId),
          sender_role: currentUserRole,
          sender_name: currentUserName,
          content: messageInput.trim(),
          message_type: selectedFile ? 'mixed' : 'text'
        })
        .select()
        .single();
      if (error) throw error;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${activeConv.id}/${msg.id}/${Date.now()}.${fileExt}`;
        await supabase.storage.from('chat_media').upload(filePath, selectedFile);
        const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);
        await supabase.from('chat_attachments').insert({
          message_id: msg.id,
          file_name: selectedFile.name,
          file_path: filePath,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          file_url: publicUrl
        });
      }

      await supabase.from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeConv.id);

      setMessageInput('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      inputRef.current?.focus();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: "Error", description: "Failed to send message." });
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSelectConv = (conv) => {
    setActiveConv(conv);
    loadMessages(conv.id);
    setShowSearch(false);
  };

  // =================================================================================
  // UI HELPERS
  // =================================================================================
  const availableGroups = Array.from(new Set(contacts.map(c => c.group_name))).sort();

  const getFilteredContacts = () => contacts.filter(c => {
    const matchesSearch = c.display_name?.toLowerCase().includes(contactFilter.toLowerCase());
    const matchesGroup = groupFilter === 'all' || c.group_name === groupFilter;
    return matchesSearch && matchesGroup;
  });

  const getSortedGroups = (filteredContacts) => {
    const grouped = filteredContacts.reduce((acc, c) => {
      const key = c.group_name || 'Others';
      if (!acc[key]) acc[key] = { items: [], order: c.sort_order || 99 };
      acc[key].items.push(c);
      return acc;
    }, {});
    return Object.entries(grouped).sort((a, b) => a[1].order - b[1].order);
  };

  const filteredContacts = getFilteredContacts();
  const sortedGroups = getSortedGroups(filteredContacts);

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'parent': return 'bg-blue-500/20 text-blue-400';
      case 'teacher': return 'bg-indigo-500/20 text-indigo-400';
      case 'administrator': return 'bg-red-500/20 text-red-400';
      case 'vice_principal': return 'bg-pink-500/20 text-pink-400';
      case 'discipline': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatRole = (role) => {
    const map = { parent: 'Parent', teacher: 'Teacher', administrator: 'Admin', vice_principal: 'VP', discipline: 'DM' };
    return map[role] || 'User';
  };

  const getAvatarGradient = (name = '') => {
    const colors = [
      'from-violet-500 to-purple-600',
      'from-blue-500 to-cyan-500',
      'from-green-500 to-teal-600',
      'from-orange-500 to-amber-500',
      'from-rose-500 to-pink-600',
      'from-indigo-500 to-blue-600',
    ];
    const idx = (name.charCodeAt(0) || 0) % colors.length;
    return colors[idx];
  };

  // Group messages by date for date separators
  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = null;
    msgs.forEach(msg => {
      const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: 'date', date: msg.created_at });
      }
      groups.push({ type: 'message', msg });
    });
    return groups;
  };

  const formatDateSeparator = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Today';
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  // =================================================================================
  // 4. RENDER
  // =================================================================================
  return (
    // Full viewport height, no external padding eating into it
    <div className="flex w-full h-full bg-background overflow-hidden" style={{ minHeight: 0 }}>
      
      {/* ================================================================
          SIDEBAR - Conversation List
          ================================================================ */}
      <div className={`
        flex flex-col border-r border-white/8
        w-full md:w-[340px] lg:w-[380px] shrink-0
        bg-card/60
        transition-all duration-300
        ${(activeConv && isMobile) ? 'hidden' : 'flex'}
      `}>
        
        {/* Sidebar Header */}
        <div className="h-[60px] px-4 flex items-center justify-between bg-muted/30 border-b border-white/5 shrink-0">
          {showSearch ? (
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search conversations..."
                  className="pl-9 h-9 bg-background/60 border-white/10 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-base tracking-tight">{t('chats') || 'Chats'}</h2>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" onClick={() => setShowSearch(true)}>
                  <Search className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                  onClick={() => { setShowNewChat(true); fetchContacts(); }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="py-1">
            {loading && (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
              </div>
            )}

            {!loading && conversations.length === 0 && (
              <div className="text-center py-16 px-6 text-muted-foreground">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 opacity-30" />
                </div>
                <p className="font-medium mb-1">No conversations yet</p>
                <p className="text-xs opacity-60 mb-4">Start a new chat to get going</p>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground"
                  onClick={() => { setShowNewChat(true); fetchContacts(); }}
                >
                  <Plus className="w-4 h-4 mr-2" /> New Chat
                </Button>
              </div>
            )}

            {conversations
              .filter(c => c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(conv => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConv(conv)}
                  className={`
                    flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors relative
                    border-b border-white/5
                    ${activeConv?.id === conv.id ? 'bg-primary/10' : 'hover:bg-muted/20 active:bg-muted/30'}
                  `}
                >
                  {/* Active indicator */}
                  {activeConv?.id === conv.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-full" />
                  )}
                  
                  <Avatar className="h-12 w-12 shrink-0 border border-white/10">
                    <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(conv.display_name)} text-white font-bold text-base`}>
                      {conv.initial}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-semibold text-sm truncate text-foreground">{conv.display_name}</h3>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {format(new Date(conv.last_message_at), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate opacity-70">
                      {conv.last_message_preview || 'Start a conversation...'}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ================================================================
          MAIN CHAT AREA
          ================================================================ */}
      <div className={`
        flex-1 flex flex-col min-w-0
        ${(!activeConv && isMobile) ? 'hidden' : 'flex'}
      `}>
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="h-[60px] px-3 flex items-center justify-between bg-card/80 border-b border-white/5 shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {/* Back button - always visible on mobile, hidden on desktop */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9 shrink-0 -ml-1"
                  onClick={() => setActiveConv(null)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(activeConv.display_name)} text-white font-bold text-sm`}>
                    {activeConv.initial}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate leading-tight">{activeConv.display_name}</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <span className="text-[10px] text-muted-foreground">Online</span>
                  </div>
                </div>
              </div>

              {/* Header actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
                  <Video className="w-4 h-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              className="flex-1 relative overflow-hidden"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {/* Background overlay */}
              <div className="absolute inset-0 bg-background/95" />

              {/* Messages scroll container — absolute so it fills the relative parent reliably */}
              <div className="absolute inset-0 overflow-y-auto z-10">
                <div className="px-3 sm:px-4 py-4 space-y-1 pb-4">
                  {groupMessagesByDate(messages).map((item, i) => {
                    if (item.type === 'date') {
                      return (
                        <div key={`date-${i}`} className="flex justify-center my-3">
                          <span className="text-[11px] bg-muted/60 text-muted-foreground px-3 py-1 rounded-full backdrop-blur-sm border border-white/5">
                            {formatDateSeparator(item.date)}
                          </span>
                        </div>
                      );
                    }

                    const { msg } = item;
                    const isMe = msg.sender_id === String(currentUserId);

                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.15 }}
                        key={msg.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}
                      >
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[70%] md:max-w-[60%]`}>
                          
                          {/* Sender name for incoming */}
                          {!isMe && (
                            <div className="flex items-center gap-1.5 mb-1 ml-1">
                              <span className="text-[11px] font-semibold text-foreground/80">{msg.sender_name}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-medium ${getRoleBadgeColor(msg.sender_role)}`}>
                                {formatRole(msg.sender_role)}
                              </span>
                            </div>
                          )}

                          {/* Bubble */}
                          <div className={`
                            px-3 py-2 rounded-2xl text-sm shadow-sm relative
                            ${isMe
                              ? 'bg-[#005c4b] dark:bg-[#005c4b] text-white rounded-tr-sm'
                              : 'bg-card dark:bg-[#1f2c34] text-foreground rounded-tl-sm border border-white/5'
                            }
                          `}>
                            
                            {/* Attachments */}
                            {msg.chat_attachments && msg.chat_attachments.length > 0 && (
                              <div className="mb-2 space-y-1">
                                {msg.chat_attachments.map(att => (
                                  <div key={att.id} className="rounded-xl overflow-hidden bg-black/20">
                                    {att.file_type.startsWith('image/') ? (
                                      <img
                                        src={att.file_url}
                                        alt="attachment"
                                        className="max-w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(att.file_url)}
                                      />
                                    ) : (
                                      <a
                                        href={att.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2.5 hover:bg-white/10 transition-colors"
                                      >
                                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                                          <FileText className="w-4 h-4 text-primary" />
                                        </div>
                                        <span className="truncate text-xs">{att.file_name}</span>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Message Text */}
                            {msg.content && (
                              <p className="whitespace-pre-wrap leading-relaxed break-words">{msg.content}</p>
                            )}

                            {/* Timestamp + Read receipt */}
                            <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-white/50' : 'text-muted-foreground'}`}>
                              <span className="text-[10px]">{format(new Date(msg.created_at), 'HH:mm')}</span>
                              {isMe && <CheckCheck className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {/* ---- INPUT BAR ---- */}
            <div className="bg-card/80 border-t border-white/5 px-2 py-2 sm:px-3 sm:py-2.5 z-20 shrink-0">
              
              {/* File preview above input */}
              <AnimatePresence>
                {selectedFile && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 mx-1 bg-muted/50 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                      <Paperclip className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-xs flex-1 truncate text-muted-foreground">{selectedFile.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2">
                
                {/* Attach button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={e => setSelectedFile(e.target.files[0])}
                  />
                </Button>

                {/* Text input */}
                <div className="flex-1 bg-muted/30 rounded-2xl border border-white/8 focus-within:border-primary/40 focus-within:bg-muted/50 transition-all overflow-hidden">
                  <Input
                    ref={inputRef}
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
                    placeholder={t('typeMessage') || 'Type a message...'}
                    className="bg-transparent border-none focus-visible:ring-0 h-10 px-4 text-sm placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Send button */}
                <Button
                  onClick={sendMessage}
                  disabled={(!messageInput.trim() && !selectedFile) || sending}
                  className="h-10 w-10 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-white p-0 shadow-md disabled:opacity-40 transition-all"
                  title="Send"
                >
                  {sending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state - desktop only */
          <div className="flex-1 hidden md:flex flex-col items-center justify-center text-muted-foreground p-10 text-center bg-background/30">
            <div className="w-28 h-28 bg-muted/20 rounded-full flex items-center justify-center mb-6 border border-white/5">
              <MessageSquare className="w-12 h-12 opacity-20" />
            </div>
            <h2 className="text-xl font-light mb-2 tracking-wide">CloudCampus Messenger</h2>
            <p className="max-w-xs text-sm opacity-60 leading-relaxed">
              Select a conversation to start chatting or create a new one.
            </p>
            <Button
              className="mt-6 bg-primary text-primary-foreground rounded-full px-6"
              onClick={() => { setShowNewChat(true); fetchContacts(); }}
            >
              <Plus className="w-4 h-4 mr-2" /> New Conversation
            </Button>
            <div className="mt-8 flex items-center gap-2 text-xs opacity-40">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              End-to-end encrypted
            </div>
          </div>
        )}
      </div>

      {/* ================================================================
          NEW CHAT MODAL
          ================================================================ */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="max-w-sm sm:max-w-md w-[calc(100vw-2rem)] h-[85vh] sm:h-[80vh] flex flex-col p-0 overflow-hidden gap-0 rounded-2xl">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <DialogTitle className="text-base font-bold">
                {currentUserRole === 'parent' ? 'Contact Administration' : (t('newChat') || 'New Discussion')}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={fetchContacts}
                disabled={contactsLoading}
                title="Refresh"
              >
                <RefreshCcw className={`w-4 h-4 ${contactsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Filter + Search */}
            <div className="flex flex-col gap-2">
              {availableGroups.length > 2 && (
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="h-9 text-xs bg-muted/50 border-white/10">
                    <SelectValue placeholder="Filter by group..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contacts</SelectItem>
                    {availableGroups.map(group => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  className="pl-9 h-9 bg-muted/50 border-white/10 text-sm"
                  value={contactFilter}
                  onChange={e => setContactFilter(e.target.value)}
                />
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-3">
              {contactsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="animate-spin w-6 h-6 text-primary" />
                </div>
              ) : sortedGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                  <User className="w-10 h-10 opacity-20" />
                  <p className="text-sm font-medium">No contacts found</p>
                  <p className="text-xs opacity-60">Try refreshing or check your filters.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {sortedGroups.map(([groupName, groupData]) => (
                    <div key={groupName}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <h3 className="text-[11px] font-bold text-primary uppercase tracking-wider">{groupName}</h3>
                        <span className="text-[10px] bg-primary/10 text-primary/70 px-1.5 py-0.5 rounded-full">
                          {groupData.items.length}
                        </span>
                      </div>
                      <div className="bg-card/60 border border-white/5 rounded-xl overflow-hidden">
                        {groupData.items.map((contact, i) => (
                          <button
                            key={contact.contact_id + i}
                            onClick={() => handleStartChat(contact)}
                            disabled={startingChat}
                            className="w-full text-left flex items-center gap-3 p-3 hover:bg-primary/10 active:bg-primary/15 transition-colors border-b border-white/5 last:border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className={`h-10 w-10 min-w-[2.5rem] rounded-full bg-gradient-to-tr ${getAvatarGradient(contact.display_name)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                              {contact.display_name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm truncate">{contact.display_name}</p>
                                {startingChat && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0 ml-2" />}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate opacity-70 mt-0.5">
                                {contact.group_name === 'Teachers' ? 'Teacher' :
                                  contact.group_name?.includes('Parent') ? 'Parent' :
                                  contact.contact_role === 'vice_principal' ? 'Vice Principal' :
                                  contact.contact_role === 'discipline' ? 'Discipline Master' :
                                  contact.contact_role === 'administrator' ? 'Administrator' :
                                  contact.contact_role}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatInterface;