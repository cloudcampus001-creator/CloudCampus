import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
ChevronLeft,
Bot,
Send,
Sparkles,
Trash2,
User,
Loader2,
Mic,
Paperclip
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Helmet } from "react-helmet";
import { useToast } from "@/components/ui/use-toast";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const MODEL = "llama-3.3-70b-versatile";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are Cloud AI, the intelligent assistant built into CloudCampus — a comprehensive school management platform used by schools in Cameroon and beyond.

## WHAT IS CLOUDCAMPUS?
CloudCampus is a full-featured school management web/mobile app that connects administrators, vice principals, discipline masters, teachers, and parents in one platform. It is built with React, Supabase (PostgreSQL backend), and supports multiple schools, multiple languages, dark/light themes, and works as both a web app and an Android APK.
CloudCampus is build by "AXION" Enterprise having "MANFOUO CALEB" as CEO.
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
- For timetable questions  → explain that the admin builds it and it drives the teacher Activity auto-detection.

Always be concise, warm, and professional. Give step-by-step guidance when needed. If something isn't part of CloudCampus, say so clearly and offer a helpful alternative.`;

const WELCOME =
"Hello! I'm Cloud AI. Ask me anything, generate images with /image prompt, upload files, or use voice input.";

const CloudAIPage = () => {

const navigate = useNavigate();
const { toast } = useToast();

const [messages, setMessages] = useState([{ role: "ai", text: WELCOME }]);
const [inputValue, setInputValue] = useState("");
const [isLoading, setIsLoading] = useState(false);

const scrollRef = useRef(null);
const inputRef = useRef(null);
const fileRef = useRef(null);

useEffect(() => {
scrollRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages, isLoading]);

const generateImage = async (prompt) => {
return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
};

const handleSendMessage = async (e) => {
e.preventDefault();

const userText = inputValue.trim();
if (!userText) return;

setMessages((prev) => [...prev, { role: "user", text: userText }]);
setInputValue("");
setIsLoading(true);

try {

if (userText.startsWith("/image")) {

const prompt = userText.replace("/image", "").trim();
const url = await generateImage(prompt);

setMessages((prev) => [
...prev,
{
role: "ai",
text: `![generated image](${url})`
}
]);

setIsLoading(false);
return;
}

const history = messages.map((m) => ({
role: m.role === "ai" ? "assistant" : "user",
content: m.text
}));

const response = await fetch(API_URL, {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${GROQ_API_KEY}`
},
body: JSON.stringify({
model: MODEL,
messages: [
{
role: "system",
content: "You are Cloud AI, a helpful professional assistant."
},
...history,
{
role: "user",
content: userText
}
],
temperature: 0.7
})
});

const data = await response.json();
const text = data?.choices?.[0]?.message?.content;

setMessages((prev) => [...prev, { role: "ai", text }]);

} catch (err) {

toast({
variant: "destructive",
title: "AI Error",
description: err.message
});

setMessages((prev) => [
...prev,
{
role: "ai",
text: "⚠️ Error communicating with AI"
}
]);

}

setIsLoading(false);

};

const handleFileUpload = (e) => {

const file = e.target.files[0];
if (!file) return;

const url = URL.createObjectURL(file);

setMessages((prev) => [
...prev,
{
role: "user",
text: `Uploaded file: ${file.name}`,
file: url
}
]);

};

const startVoice = () => {

const recognition = new window.webkitSpeechRecognition();
recognition.lang = "en-US";

recognition.onresult = (event) => {

const transcript = event.results[0][0].transcript;
setInputValue(transcript);

};

recognition.start();

};

const clearChat = () => setMessages([{ role: "ai", text: WELCOME }]);

return (
<> <Helmet>

<title>Cloud AI</title>
</Helmet>

<div className="min-h-screen flex flex-col bg-background">

<header className="flex items-center justify-between p-4 border-b">

<div className="flex items-center gap-3">

<Button
variant="ghost"
size="icon"
onClick={() => navigate(-1)}

>

<ChevronLeft />
</Button>

<div className="flex items-center gap-2">

<div className="p-2 bg-indigo-600 rounded-lg">
<Bot className="text-white w-5 h-5" />
</div>

<div>
<h1 className="font-bold">Cloud AI</h1>
<p className="text-xs text-muted-foreground">
Powered by Llama 3.3
</p>
</div>

</div>

</div>

<Button
variant="ghost"
onClick={clearChat}

>

<Trash2 className="w-4 h-4 mr-2"/>
Clear
</Button>

</header>

<ScrollArea className="flex-1 p-6">

<div className="max-w-3xl mx-auto space-y-6">

<AnimatePresence>

{messages.map((msg, idx) => {

const isAi = msg.role === "ai";

return (

<motion.div
key={idx}
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
className={`flex gap-4 ${isAi ? "justify-start" : "justify-end"}`}

>

{isAi && ( <Avatar> <AvatarFallback className="bg-indigo-600"> <Bot className="text-white w-4 h-4" /> </AvatarFallback> </Avatar>
)}

<div
className={`max-w-[75%] p-4 rounded-xl ${
isAi
? "bg-card border"
: "bg-indigo-600 text-white"
}`}
>

<ReactMarkdown
remarkPlugins={[remarkGfm]}
rehypePlugins={[rehypeHighlight]}
className="prose prose-invert max-w-none"
components={{
img: ({node,...props}) => (
<img
{...props}
className="rounded-xl mt-2"
/>
)
}}

>

{msg.text}

</ReactMarkdown>

{msg.file && ( <img
src={msg.file}
className="mt-2 rounded-xl max-h-64"
/>
)}

</div>

{!isAi && ( <Avatar> <AvatarFallback className="bg-zinc-700"> <User className="text-white w-4 h-4"/> </AvatarFallback> </Avatar>
)}

</motion.div>

);

})}

</AnimatePresence>

{isLoading && (

<div className="flex gap-3">

<Loader2 className="animate-spin"/>

<span className="text-sm text-muted-foreground">
Thinking...
</span>

</div>
)}

<div ref={scrollRef} />

</div>

</ScrollArea>

<div className="p-4 border-t">

<form
onSubmit={handleSendMessage}
className="flex items-center gap-2"
>

<input
type="file"
ref={fileRef}
className="hidden"
onChange={handleFileUpload}
/>

<Button
type="button"
variant="ghost"
size="icon"
onClick={() => fileRef.current.click()}

>

<Paperclip />
</Button>

<Button
type="button"
variant="ghost"
size="icon"
onClick={startVoice}

>

<Mic />
</Button>

<Input
ref={inputRef}
value={inputValue}
onChange={(e) => setInputValue(e.target.value)}
placeholder="Ask something or type /image prompt"
/>

<Button
type="submit"
size="icon"
disabled={isLoading}

>

<Send />
</Button>

</form>

</div>

</div>
</>
);

};

export default CloudAIPage;
