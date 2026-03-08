import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bot, Send, Sparkles, Trash2, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Helmet } from 'react-helmet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';

// ─── API KEY IS LOADED FROM YOUR .env FILE ───────────────────────────────────
// 1. Create a file named  .env  in the ROOT of your project (next to package.json)
// 2. Add this line:  VITE_GROQ_API_KEY=your_key_here
// 3. Get your free key at https://console.groq.com  (no credit card needed)
// ─────────────────────────────────────────────────────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const MODEL   = 'llama-3.3-70b-versatile'; // free, fast, very smart
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are Cloud AI, the intelligent assistant built into CloudCampus — a comprehensive school management platform used by schools in Cameroon and beyond.

## WHAT IS CLOUDCAMPUS?
CloudCampus is a full-featured school management web/mobile app that connects administrators, vice principals, discipline masters, teachers, and parents in one platform. It is built with React, Supabase (PostgreSQL backend), and supports multiple schools, multiple languages, dark/light themes, and works as both a web app and an Android APK.

---

## PLATFORM ROLES — what each user can do:

### 🔵 ADMINISTRATOR
The admin has full control over the school setup. They can:
- **Dashboard (AdminHome):** See key stats — total students, total teachers, total classes, discipline cases, and a weekly attendance chart. Also send school-wide notifications targeting: the whole school, teachers, staff, parents, vice principals, or discipline masters.
- **Users (AdminUsersPage):** Create and manage all user accounts — teachers, vice principals, discipline masters, and parents. Each parent account is linked to a student matricule.
- **Classes (AdminClassesPage):** Create and manage classes. Assign a vice principal and a discipline master to each class.
- **Subjects Library (AdminSubjectsLibraryPage):** Manage the school's list of subjects that can be assigned to classes.
- **Timetable (AdminTimetablePage):** Build the weekly timetable for each class. Each slot has a day, start time, end time, subject, and assigned teacher. Subjects in the timetable come from the class's assigned subject list.
- **Chat (AdminChatPage):** Communicate with staff members.

### 🟣 VICE PRINCIPAL (VP)
The VP oversees one or more classes. They can:
- **Overview (VPHome):** See their selected class info, student count, and recent notifications targeting vice principals or the whole school.
- **Logbook (VPLogbookPage):** Review e-logbook entries submitted by teachers. Entries go through statuses: pending → viewed → completed. The VP can leave comments on entries, which creates a notification sent to the teacher. Drill-down: Subject tiles → Entry list → Full entry detail.
- **Marks (VPMarksPage):** View all marks entered for their class. Two view modes: Organized (accordion by Sequence → Subject → students) and Flat table. Generate report cards by selecting sequences — shows ranked students with averages. Can export to CSV or print/PDF.
- **Attribute Subjects (AttributeSubjectsPage):** For each subject in the class timetable, toggle between Obligatory (all students) and Additional (select specific enrolled students). Manage per-student enrollments in optional subjects.
- **Notify (VPNotifyPage):** Send notifications to the whole class or specific students/parents.
- **Chat (VPChatPage):** Communicate with other staff.

### 🟠 DISCIPLINE MASTER (DM)
The DM manages student behavior and absences. They can:
- **Dashboard (DisciplineHome):** See stats — pending justifications, registers reviewed, punishments issued. See recent notifications.
- **Register Review (RegisterReviewPage):** Review attendance registers (e-logbook entries) for their assigned classes. View which students were marked absent in each class session.
- **Punish (PunishPage):** Issue a punishment to a student. Select the class, then choose the student by matricule, enter the reason and punishment details. Saved to the punishments table.
- **Justifications (JustificationsPage):** Review justification requests submitted by parents. Each justification has a message and optional uploaded file (e.g. medical certificate). The DM can approve or reject them. Approved justifications change absence status from unjustified to justified.
- **Chat (DisciplineChatPage):** Communicate with staff.

### 🟡 TEACHER
Teachers manage their classes day-to-day. They can:
- **Home (TeacherHomePage):** See today's timetable (classes scheduled for the current day), count of today's sessions, and number of pending e-logbook entries.
- **Activity (ActivityPage):** The core teaching tool. Automatically detects the current active class based on day and time from the timetable. In one screen: mark student attendance (present/absent), write the lesson topic and sub-topics, then submit the e-logbook entry. The entry goes to the VP for review.
- **Marks (MarksPage):** Enter student marks. Select a class, subject, and sequence (Sequence 1 through 6). The system respects subject enrollment — obligatory subjects show all students; additional subjects show only enrolled students. Warns if marks already exist for that combination (duplicate prevention). Can bulk-fill absent/zero students with "00".
- **Publish (PublishPage):** Upload documents (lessons, exercises, exams) for a class. Documents are visible to parents and students of that class. Types: document or book.
- **Notify (NotifyPage):** Send notifications to an individual student, an entire class, or all classes. Notifications appear in parents' notification feed.
- **Chat (TeacherChatPage):** Communicate with other teachers or staff.
- **Notifications (TeacherNotificationsPage):** View notifications addressed to teachers or the whole school.

### 🟢 PARENT
Parents monitor their child's school life. They can:
- **Overview (OverviewPage):** General summary of their child's status at school.
- **Discipline (DisciplinePage):** See total unjustified absence hours and list of punishments issued to their child. Submit a justification for an absence — write a message and optionally upload a supporting file (e.g. medical certificate). This goes to the Discipline Master for review.
- **Documents (DocsPage):** Access documents published by teachers for their child's class — lessons, exercises, handouts. Can view and download.
- **Library (LibraryPage):** Access digital books uploaded by the school administration for the whole school.
- **Notifications (ParentNotificationsPage):** View notifications from teachers, vice principal, or administration.
- **Chat (ChatPage):** Communicate with teachers or staff.

---

## KEY CONCEPTS & DATA STRUCTURES:

- **School ID:** Every piece of data is scoped to a school_id. Multiple schools can use CloudCampus independently.
- **Sequences:** The academic year uses 6 sequences (Sequence 1 to 6) for grading — roughly 2 per term in the Cameroonian school system.
- **Student Matricule:** Each student has a unique matricule number used for identification across the system.
- **Timetable:** Defines which teacher teaches which subject in which class on which day and time. This drives the Activity page's auto-detection of the current class.
- **E-Logbook:** When a teacher submits an Activity entry (topic + attendance), it creates an e_logbook_entry record with status "pending". The VP reviews it, changing it to "viewed" then "completed". VPs can comment on entries.
- **Notifications:** Target types include: school (everyone), teacher, staff, parent, vice_principal, discipline_master, class (specific class parents/students).
- **Justifications:** A parent submits a justification → DM reviews → approved or rejected → if approved, absences become justified.
- **Punishments:** Issued by DM, visible to parents via the Discipline page.
- **Subjects:** Can be Obligatory (all students in class) or Additional (only enrolled students). VP manages this per class.
- **Documents:** Teachers upload files (PDF, etc.) linked to a class. Parents see them in the Documents tab.
- **Library Books:** Admin uploads books for the whole school. All parents can access them.
- **Session persistence:** Sessions last 5 days of inactivity. The app works as a PWA and APK.

---

## HOW TO HELP USERS:

- If a **teacher** asks "how do I take attendance?" → explain the Activity page: it auto-detects their current class, they tap absent students, write the topic, and submit.
- If a **parent** asks "where are my child's documents?" → explain the Documents tab in their dashboard.
- If a **VP** asks "how do I see what teachers taught?" → explain the Logbook page with the drill-down flow.
- If a **DM** asks "how do I approve a justification?" → explain the Justifications page.
- If an **admin** asks "how do I add a teacher?" → explain the Users page.
- For marks questions → explain the 6-sequence system and how obligatory vs additional subjects work.
- For notification questions → explain the target types and who can send to whom.
- For timetable questions → explain that the admin builds it and it drives the teacher Activity auto-detection.

Always be concise, warm, and professional. Give step-by-step guidance when needed. If something isn't part of CloudCampus, say so clearly and offer a helpful alternative.`;

const WELCOME = "Hello! I'm Cloud AI, your CloudCampus assistant. Ask me anything about school management, lessons, or administration!";

const CloudAIPage = () => {
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [messages,   setMessages]   = useState([{ role: 'ai', text: WELCOME }]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading,  setIsLoading]  = useState(false);
  const scrollRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const userText = inputValue.trim();
    if (!userText || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInputValue('');
    setIsLoading(true);

    try {
      if (!GROQ_API_KEY) {
        throw new Error(
          'API key not set. Create a .env file in your project root and add: VITE_GROQ_API_KEY=your_key_here (get a free key at console.groq.com)'
        );
      }

      // Build message history in OpenAI-compatible format (Groq uses same format)
      const history = messages
        .filter(m => m.text !== WELCOME && m.text)
        .map(m => ({
          role:    m.role === 'ai' ? 'assistant' : 'user',
          content: m.text,
        }));

      const apiMessages = [
        { role: 'system',    content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: userText },
      ];

      const response = await fetch(API_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model:      MODEL,
          messages:   apiMessages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg     = errBody?.error?.message || '';
        const status  = response.status;

        if (status === 401 || msg.toLowerCase().includes('invalid api key') || msg.toLowerCase().includes('auth')) {
          throw new Error('Invalid API key. Make sure you copied the full key from console.groq.com and replaced GROQ_API_KEY in CloudAIPage.jsx.');
        } else if (status === 429) {
          throw new Error('Too many requests — wait a moment and try again. Groq free tier allows 30 requests/minute.');
        } else {
          throw new Error(msg || `API error ${status}`);
        }
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from AI');

      setMessages(prev => [...prev, { role: 'ai', text }]);

    } catch (err) {
      console.error('Cloud AI error:', err);
      toast({ variant: 'destructive', title: 'AI Error', description: err.message });
      setMessages(prev => [...prev, { role: 'ai', text: `⚠️ ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => setMessages([{ role: 'ai', text: WELCOME }]);

  const formatText = (text) =>
    String(text || '').split('\n').map((line, i) => (
      <span key={i} className="block min-h-[1.2em] mb-1 last:mb-0">
        {line.split(/(\*\*.*?\*\*)/g).map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="font-semibold text-indigo-200">{part.slice(2, -2)}</strong>
            : part
        )}
      </span>
    ));

  return (
    <>
      <Helmet><title>Cloud AI - CloudCampus</title></Helmet>

      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-500/10 to-transparent -z-10" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -z-10" />
        <div className="absolute top-40 -left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl -z-10" />

        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-none">Cloud AI</h1>
                <p className="text-xs text-muted-foreground">Powered by Llama 3.3</p>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground hover:text-red-400">
            <Trash2 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Clear Chat</span>
          </Button>
        </header>

        {/* Chat area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <ScrollArea className="flex-1 px-4 py-6">
            <div className="max-w-3xl mx-auto space-y-6 pb-24">

              {messages.length <= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-4 p-8 rounded-3xl bg-card/30 border border-white/10 mb-8"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                    <Sparkles className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h2 className="text-2xl font-bold">Hello!</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    I'm your AI assistant. Ask me anything about school work, teaching materials, or administrative tasks.
                  </p>
                </motion.div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isAi = msg.role === 'ai';
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-4 ${isAi ? 'justify-start' : 'justify-end'}`}
                    >
                      {isAi && (
                        <Avatar className="h-8 w-8 mt-1 border border-white/10 shadow-sm flex-shrink-0">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600">
                            <Bot className="w-4 h-4 text-white" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                        isAi
                          ? 'bg-card/80 border border-white/10 rounded-tl-sm'
                          : 'bg-indigo-600 text-white rounded-tr-sm'
                      }`}>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {isAi ? formatText(msg.text) : msg.text}
                        </div>
                      </div>
                      {!isAi && (
                        <Avatar className="h-8 w-8 mt-1 border border-white/10 flex-shrink-0">
                          <AvatarFallback className="bg-zinc-700">
                            <User className="w-4 h-4 text-white" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 justify-start">
                  <Avatar className="h-8 w-8 mt-1 border border-white/10 flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600">
                      <Bot className="w-4 h-4 text-white" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-card/80 border border-white/10 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <span className="text-xs text-muted-foreground ml-2">Thinking…</span>
                  </div>
                </motion.div>
              )}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input bar */}
          <div className="p-4 bg-gradient-to-t from-background via-background to-transparent pt-10 mt-auto">
            <div className="max-w-3xl mx-auto">
              <form
                onSubmit={handleSendMessage}
                className="relative flex items-center gap-2 p-2 bg-background/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl focus-within:border-indigo-500/50 transition-colors"
              >
                <div className="pl-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                </div>
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  placeholder="Ask a question…"
                  className="border-none bg-transparent focus-visible:ring-0 px-3 py-3 h-auto shadow-none"
                  disabled={isLoading}
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputValue.trim() || isLoading}
                  className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 shrink-0"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                </Button>
              </form>
              <p className="text-[10px] text-center text-muted-foreground mt-2 opacity-60">
                Cloud AI may generate inaccurate information. Please verify important details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CloudAIPage;
