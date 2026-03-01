
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Paperclip, MoreVertical, Search, ChevronLeft, 
  MessageSquare, Plus, User, ArrowLeft, Loader2, FileText, CheckCheck, X,
  Filter, RefreshCcw
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const [contactFilter, setContactFilter] = useState(''); // Text search inside modal
  const [groupFilter, setGroupFilter] = useState('all'); // Dropdown category/class filter
  const [startingChat, setStartingChat] = useState(false); // New state for loader when clicking contact
  
  // -- FILE UPLOAD --
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // -- REFS --
  const messagesEndRef = useRef(null);
  const chatChannelRef = useRef(null);

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
    
    // Subscribe to new messages globally for the list update
    const channel = supabase
      .channel('public:chat_messages_v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          handleRealtimeMessage(payload.new);
        }
      )
      .subscribe();

    chatChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, currentUserRole]);

  const handleRealtimeMessage = (newMsg) => {
    // 1. If this message belongs to the active conversation, append it
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

    // 2. Update conversation list order and preview
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === newMsg.conversation_id);
      if (idx === -1) {
         fetchConversations(); 
         return prev;
      }
      
      const updated = { 
        ...prev[idx], 
        last_message_at: newMsg.created_at, 
        last_message_preview: newMsg.content 
      };
      
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
      
      // Get conversations I am part of
      const { data: convs, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .contains('participant_ids', [userIdentifier])
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Enrich with the name I should see (from chat_participants)
      const enriched = await Promise.all(convs.map(async (conv) => {
        if (conv.is_group) return conv; 

        // Find the "other" person to get their ID for display logic
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

    setContactsLoading(true);
    try {
      // Pass ID as string to RPC, but we've robustly handled it in SQL now
      const { data, error } = await supabase.rpc('get_chat_contacts', {
        p_school_id: relatedContext?.schoolId || 0, // Ensure not null to avoid SQL error
        p_user_role: currentUserRole,
        p_user_id: String(currentUserId) 
      });

      if (error) throw error;
      setContacts(data || []);
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
    if (startingChat) return; // Prevent double clicks
    setStartingChat(true);
    
    try {
      // Create or Get Conversation with specific naming
      const { data: convId, error } = await supabase.rpc('get_or_create_direct_conversation_v2', {
        p_user1_id: String(currentUserId),
        p_user1_role: currentUserRole,
        p_user1_display_name: contact.my_display_name || currentUserName || 'User', // Fallback safety
        p_user2_id: contact.contact_id,
        p_user2_role: contact.contact_role,
        p_user2_display_name: contact.display_name // How I see them
      });

      if (error) throw error;
      
      // Close modal
      setShowNewChat(false);

      // Check if this convo is already in our list
      const existingConv = conversations.find(c => c.id === convId);
      
      if (existingConv) {
        setActiveConv(existingConv);
        loadMessages(convId);
      } else {
        // Construct object to immediately switch to
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
      // 1. Insert Message
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

      // 2. Handle File
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

      // 3. Touch Conversation
      await supabase.from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeConv.id);

      setMessageInput('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: "Error", description: "Failed to send message." });
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  // --------------------------------------------------------------------------
  // UI LOGIC FOR NEW CHAT MODAL
  // --------------------------------------------------------------------------

  // 1. Extract unique group names for the filter dropdown
  const availableGroups = Array.from(new Set(contacts.map(c => c.group_name))).sort();

  // 2. Filter contacts based on search text AND group selection
  const getFilteredContacts = () => {
    return contacts.filter(c => {
      // Search Text match
      const matchesSearch = c.display_name?.toLowerCase().includes(contactFilter.toLowerCase());
      // Group match
      const matchesGroup = groupFilter === 'all' || c.group_name === groupFilter;
      
      return matchesSearch && matchesGroup;
    });
  };

  // 3. Group the filtered results for display
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

  // Helper for role badges
  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'parent': return 'bg-blue-500/20 text-blue-500';
      case 'teacher': return 'bg-indigo-500/20 text-indigo-500';
      case 'administrator': return 'bg-red-500/20 text-red-500';
      case 'vice_principal': return 'bg-pink-500/20 text-pink-500';
      case 'discipline': return 'bg-orange-500/20 text-orange-500';
      default: return 'bg-gray-500/20 text-gray-500';
    }
  };

  const formatRole = (role) => {
    switch(role) {
      case 'parent': return 'Parent';
      case 'teacher': return 'Teacher';
      case 'administrator': return 'Admin';
      case 'vice_principal': return 'VP';
      case 'discipline': return 'Discipline';
      default: return 'User';
    }
  };


  // =================================================================================
  // 4. RENDER
  // =================================================================================
  return (
    <div className="flex h-[calc(100vh-120px)] bg-background border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
      
      {/* SIDEBAR */}
      <div className={`
        w-full md:w-[350px] border-r border-white/10 bg-card/50 flex flex-col
        ${(activeConv && isMobile) ? 'hidden' : 'flex'}
      `}>
        {/* Sidebar Header */}
        <div className="p-4 bg-muted/20 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-bold text-lg">{t('chats')}</h2>
          <Button 
            size="icon" 
            className="rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
            onClick={() => { setShowNewChat(true); fetchContacts(); }}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-3">
           <div className="relative">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder={t('searchChats')} 
               className="pl-9 bg-background/50 border-white/10"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading && <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>}
            
            {!loading && conversations.length === 0 && (
              <div className="text-center py-10 px-4 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No conversations yet.</p>
                <Button variant="link" onClick={() => { setShowNewChat(true); fetchContacts(); }}>Start a chat</Button>
              </div>
            )}

            {conversations
              .filter(c => c.display_name?.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(conv => (
              <div
                key={conv.id}
                onClick={() => { setActiveConv(conv); loadMessages(conv.id); }}
                className={`
                  flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
                  ${activeConv?.id === conv.id ? 'bg-primary/10 border-primary/20' : 'border-transparent hover:bg-muted/30'}
                `}
              >
                <Avatar className="h-12 w-12 border border-white/10">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
                    {conv.initial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm truncate">{conv.display_name}</h3>
                    <span className="text-[10px] text-muted-foreground">
                      {conv.last_message_at ? format(new Date(conv.last_message_at), 'HH:mm') : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate opacity-80">
                     {conv.last_message_preview || 'Start conversation...'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`
        flex-1 flex flex-col bg-[#0b141a]/5 dark:bg-[#0b141a]/40
        ${(!activeConv && isMobile) ? 'hidden' : 'flex'}
      `}>
        {activeConv ? (
          <>
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between bg-card border-b border-white/5 shadow-sm z-10">
               <div className="flex items-center gap-3">
                 <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveConv(null)}>
                   <ChevronLeft />
                 </Button>
                 <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">{activeConv.initial}</AvatarFallback>
                 </Avatar>
                 <div>
                    <h3 className="font-bold text-sm">{activeConv.display_name}</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] text-muted-foreground">Online</span>
                    </div>
                 </div>
               </div>
               <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
            </div>

            {/* Messages */}
            <div className="flex-1 relative overflow-hidden bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-repeat opacity-95">
               <div className="absolute inset-0 bg-background/90 backdrop-blur-[2px]" /> 
               
               <ScrollArea className="h-full px-4 py-4 relative z-10">
                 <div className="space-y-2 pb-4">
                   {messages.map((msg, i) => {
                     const isMe = msg.sender_id === String(currentUserId);
                     const showTail = !messages[i+1] || messages[i+1].sender_id !== msg.sender_id;
                     
                     return (
                       <motion.div 
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         key={msg.id} 
                         className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}
                       >
                         <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] md:max-w-[60%]`}>
                           {!isMe && (
                             <div className="flex items-center gap-2 mb-1 ml-1">
                               <span className="text-[10px] font-bold text-foreground/80">{msg.sender_name}</span>
                               <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase ${getRoleBadgeColor(msg.sender_role)}`}>
                                 {formatRole(msg.sender_role)}
                               </span>
                             </div>
                           )}
                           <div className={`
                             px-3 py-2 rounded-lg text-sm shadow-sm relative w-full
                             ${isMe ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-card dark:bg-[#202c33] text-foreground rounded-tl-none'}
                           `}>
                             {/* Attachments */}
                             {msg.chat_attachments && msg.chat_attachments.length > 0 && (
                               <div className="mb-2">
                                 {msg.chat_attachments.map(att => (
                                   <div key={att.id} className="rounded overflow-hidden mb-1 bg-black/20">
                                      {att.file_type.startsWith('image/') ? (
                                        <img src={att.file_url} alt="att" className="max-w-full" onClick={() => window.open(att.file_url)} />
                                      ) : (
                                        <a href={att.file_url} target="_blank" className="flex items-center gap-2 p-2 hover:bg-white/10">
                                          <FileText className="w-4 h-4" /> <span className="truncate">{att.file_name}</span>
                                        </a>
                                      )}
                                   </div>
                                 ))}
                               </div>
                             )}

                             <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                             
                             <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMe ? 'text-white/60' : 'text-muted-foreground'}`}>
                               <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                               {isMe && <CheckCheck className="w-3 h-3" />}
                             </div>
                           </div>
                         </div>
                       </motion.div>
                     );
                   })}
                   <div ref={messagesEndRef} />
                 </div>
               </ScrollArea>
            </div>

            {/* Input */}
            <div className="p-3 bg-card border-t border-white/5 flex items-end gap-2 z-20">
               {selectedFile && (
                  <div className="absolute bottom-20 left-4 bg-popover p-2 rounded-lg shadow-xl border flex items-center gap-2 animate-in slide-in-from-bottom-5">
                     <Paperclip className="w-4 h-4" />
                     <span className="text-xs max-w-[150px] truncate">{selectedFile.name}</span>
                     <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setSelectedFile(null)}><X className="w-3 h-3" /></Button>
                  </div>
               )}
               
               <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
                 <Paperclip className="w-5 h-5" />
                 <input type="file" className="hidden" ref={fileInputRef} onChange={e => setSelectedFile(e.target.files[0])} />
               </Button>
               
               <div className="flex-1 bg-muted/30 rounded-lg border border-transparent focus-within:border-primary/50 transition-colors">
                 <Input 
                   value={messageInput}
                   onChange={e => setMessageInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
                   placeholder={t('typeMessage')}
                   className="bg-transparent border-none focus-visible:ring-0 min-h-[40px]"
                 />
               </div>
               
               <Button 
                 onClick={sendMessage} 
                 disabled={(!messageInput.trim() && !selectedFile) || sending}
                 className="bg-primary hover:bg-primary/90 text-white rounded-lg w-10 h-10 p-0"
               >
                 {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
               </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10 text-center bg-background/50">
            <div className="w-32 h-32 bg-muted/20 rounded-full flex items-center justify-center mb-6">
               <img src="https://cdni.iconscout.com/illustration/premium/thumb/online-messaging-5379654-4497740.png" alt="Chat" className="w-24 opacity-60 grayscale" />
            </div>
            <h2 className="text-2xl font-light mb-2">CloudCampus Messenger</h2>
            <p className="max-w-md text-sm opacity-70">Send and receive messages without keeping your phone online.<br/>Connect with teachers, parents, and school administration.</p>
            <div className="mt-8 flex items-center gap-2 text-xs opacity-50">
               <span className="w-3 h-3 bg-green-500 rounded-full" /> End-to-end encrypted
            </div>
          </div>
        )}
      </div>

      {/* NEW CHAT MODAL */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
         <DialogContent className="max-w-md h-[80vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-4 border-b border-white/10">
               <div className="flex items-center justify-between">
                 <DialogTitle>
                    {currentUserRole === 'parent' ? 'Contact Administration' : (t('newChat') || 'New Discussion')}
                 </DialogTitle>
                 <Button variant="ghost" size="icon" onClick={fetchContacts} disabled={contactsLoading} title="Refresh Contacts">
                   <RefreshCcw className={`w-4 h-4 ${contactsLoading ? 'animate-spin' : ''}`} />
                 </Button>
               </div>
               
               <div className="flex flex-col gap-2 mt-2">
                 {/* Filter Dropdown - Only show if we have many groups */}
                 {availableGroups.length > 2 && (
                    <div className="w-full">
                      <Select value={groupFilter} onValueChange={setGroupFilter}>
                        <SelectTrigger className="h-8 text-xs bg-muted/50 border-white/10 w-full">
                          <SelectValue placeholder="Filter contacts..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Contacts</SelectItem>
                          {availableGroups.map(group => (
                            <SelectItem key={group} value={group}>{group}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                 )}

                 {/* Search Input */}
                 <div className="relative">
                   <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                   <Input 
                     placeholder="Search contacts..." 
                     className="pl-9 bg-muted/50"
                     value={contactFilter}
                     onChange={e => setContactFilter(e.target.value)}
                   />
                 </div>
               </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1 p-4">
               {contactsLoading ? (
                 <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
               ) : sortedGroups.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                   <User className="w-12 h-12 opacity-20 mb-2" />
                   <p>No contacts found.</p>
                   <p className="text-xs opacity-60">Try refreshing or contacting support.</p>
                 </div>
               ) : (
                 <div className="space-y-6">
                    {sortedGroups.map(([groupName, groupData]) => {
                      return (
                        <div key={groupName} className="animate-in fade-in duration-500">
                           <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
                             {groupName} <span className="text-[9px] opacity-50 bg-primary/10 px-1 rounded">{groupData.items.length}</span>
                           </h3>
                           <div className="bg-card/50 border border-white/5 rounded-xl overflow-hidden">
                              {groupData.items.map((contact, i) => (
                                <button 
                                  key={contact.contact_id + i}
                                  onClick={() => handleStartChat(contact)}
                                  disabled={startingChat}
                                  className="w-full text-left flex items-center gap-3 p-3 hover:bg-primary/10 cursor-pointer transition-colors border-b border-white/5 last:border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                   <div className="h-10 w-10 min-w-[2.5rem] rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                                      {contact.display_name[0]}
                                   </div>
                                   <div className="overflow-hidden flex-1">
                                      <div className="flex justify-between items-center">
                                        <p className="font-medium text-sm truncate">{contact.display_name}</p>
                                        {startingChat && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                                      </div>
                                      <p className="text-[10px] text-muted-foreground truncate opacity-70">
                                         {contact.group_name === 'Teachers' ? 'Teacher' : 
                                          contact.group_name.includes('Parent') ? 'Parent' : 
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
                      );
                    })}
                 </div>
               )}
            </ScrollArea>
         </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatInterface;
