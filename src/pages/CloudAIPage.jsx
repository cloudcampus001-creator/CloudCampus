import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Send, Sparkles, Trash2, User, Loader2,
  Copy, Check, Image, Code2, FlaskConical, Calculator,
  Zap, BookOpen, GraduationCap, Building2, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const MODEL        = 'llama-3.3-70b-versatile';
const API_URL      = 'https://api.groq.com/openai/v1/chat/completions';

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Cloud AI — the official intelligent assistant of CloudCampus, built and owned by Axion Enterprise.

## IDENTITY
- Your name: Cloud AI
- Your creator: Axion Enterprise
- The platform you power: CloudCampus — a comprehensive school management system
- CloudCampus and Cloud AI are both products of Axion Enterprise
- You are not ChatGPT, Claude, or Gemini. You are Cloud AI by Axion Enterprise.

## FORMATTING RULES — CRITICAL, FOLLOW ALWAYS:
- For ANY code (JavaScript, Python, SQL, HTML, CSS, etc.): wrap in \`\`\`language\\n...\\n\`\`\`
- For math equations: use LaTeX syntax wrapped in $$...$$ for block math, or $...$ for inline
- For chemical formulas: write them using standard notation like H₂O, CO₂, C₆H₁₂O₆ (use Unicode subscripts)
- For chemical reaction equations: write on their own line using → for arrows and proper formatting
- For numbered steps: use 1. 2. 3. format
- For lists: use - item format
- For headings: use ## Heading format
- When asked to generate/draw/create/show an image: respond ONLY with [IMAGE: detailed descriptive prompt of the image] then a newline then a brief caption. Do not add anything else before [IMAGE:].
- Be precise with LaTeX: use \\frac{}{}, \\sqrt{}, \\sum_{}{}, \\int_{}{}, \\vec{}, \\alpha, \\beta, etc.

## CLOUDCAMPUS PLATFORM KNOWLEDGE:

### About CloudCampus
CloudCampus is a full-featured school management web/mobile app built by Axion Enterprise. It connects administrators, vice principals, discipline masters, teachers, and parents in one unified platform. Built with React + Vite frontend, Supabase (PostgreSQL) backend. Supports multiple schools, bilingual (French/English), dark/light themes, PWA + Android APK.

### ROLES AND THEIR CAPABILITIES:

**🔵 ADMINISTRATOR**
- Dashboard: Stats (students, teachers, classes, discipline cases), weekly attendance chart, school-wide notifications
- Users Page: Create/manage all accounts (teachers, VPs, DMs, parents). Parents linked to student matricule
- Classes Page: Create/manage classes, assign VP and DM to each class
- Subjects Library: Manage school subject catalogue
- Timetable: Build weekly schedule (day, time, subject, teacher per class slot)
- Chat: Communicate with all staff

**🟣 VICE PRINCIPAL (VP)**
- Overview: Class info, student count, notifications
- Logbook Review: Review teacher e-logbook entries (pending→viewed→completed), add comments
- Marks/Report Cards: View all marks, generate ranked report cards by sequence, export CSV/PDF
- Attribute Subjects: Toggle subjects between Obligatory (all students) and Additional (enrolled only)
- Notify: Send notifications to class or specific students
- Chat: Staff communication

**🟠 DISCIPLINE MASTER (DM)**
- Dashboard: Stats (justifications pending, registers reviewed, punishments issued)
- Register Review: Check attendance registers, see absent students per session
- Punish: Issue punishments — select class, student by matricule, enter reason
- Justifications: Review parent justifications (approve/reject), approved ones convert absences to justified
- Chat: Staff communication

**🟡 TEACHER**
- Home: Today's timetable, session count, pending logbook entries
- Activity Page: Auto-detects current class from timetable. Mark attendance + write lesson topic + submit e-logbook
- Marks: Enter student grades by class/subject/sequence. Handles obligatory vs additional subjects
- Publish: Upload documents (lessons, exercises, exams) for a class — visible to parents
- Notify: Send to individual student, class, or all classes
- Chat: Communication with staff
- Notifications: View school/teacher-targeted notifications

**🟢 PARENT**
- Overview: Child's school status summary
- Discipline: See unjustified absence hours + punishments. Submit justification with optional file upload
- Documents: Access teacher-published lessons, exercises, handouts for child's class
- Library: Access school digital book library
- Notifications: View from teachers, VP, admin
- Chat: Contact teachers and staff

### KEY CONCEPTS:
- **Sequences**: 6 sequences per year (2 per term) — Cameroonian school system
- **Student Matricule**: Unique ID per student used across system
- **Timetable**: Drives Activity page auto-detection of current teacher class
- **E-Logbook**: Teacher submits → VP reviews → completed. VP can comment
- **Notification targets**: school, teacher, staff, parent, vice_principal, discipline_master, class
- **Justifications**: Parent submits → DM reviews → if approved, absences become justified
- **Subject types**: Obligatory (all students) vs Additional (only enrolled students), managed by VP
- **Session**: 5-day inactivity timeout. Works as PWA and APK

## YOUR CAPABILITIES:
You excel at:
- Explaining and guiding CloudCampus usage to any role
- Academic subjects: mathematics, physics, chemistry, biology, literature, history, computer science
- Writing code: JavaScript, Python, HTML, CSS, SQL, React, Node.js, and more
- Solving math problems step-by-step with proper LaTeX notation
- Explaining chemical reactions and formulas
- Essay writing, lesson planning, study materials
- Generating images on demand

Always be warm, precise, and professional. Give step-by-step guidance when needed.`;

// ─── SUGGESTED PROMPTS ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: GraduationCap, label: 'How do I take attendance?',   color: 'from-blue-500 to-cyan-500' },
  { icon: Calculator,    label: 'Solve: ∫x²dx step by step',  color: 'from-violet-500 to-purple-500' },
  { icon: FlaskConical,  label: 'Balance: H₂ + O₂ → H₂O',    color: 'from-green-500 to-teal-500' },
  { icon: Code2,         label: 'Write a Python bubble sort',  color: 'from-orange-500 to-amber-500' },
  { icon: Image,         label: 'Generate image of a school',  color: 'from-pink-500 to-rose-500' },
  { icon: BookOpen,      label: 'What can parents do?',        color: 'from-indigo-500 to-blue-500' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const isImageRequest = (text) => {
  const t = text.toLowerCase();
  return /^(generate|draw|create|make|show|paint|design|sketch)\s+(a\s+|an\s+|me\s+a\s+|me\s+an\s+)?(image|picture|photo|illustration|drawing|artwork|painting|portrait|landscape|scene|diagram)/i.test(t)
    || t.startsWith('image of ')
    || t.startsWith('picture of ');
};

const generateImageUrl = (prompt) =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=512&nologo=true&seed=${Math.floor(Math.random()*9999)}`;

// ─── RICH MESSAGE RENDERER ───────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// Syntax colouring — lightweight manual approach
function highlightCode(code, lang) {
  const esc = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const l = (lang || '').toLowerCase();

  if (['js','javascript','jsx','ts','typescript','tsx'].includes(l)) {
    return esc
      .replace(/\/\/.*/g, m => `<span class="text-zinc-500 italic">${m}</span>`)
      .replace(/(\/\*[\s\S]*?\*\/)/g, m => `<span class="text-zinc-500 italic">${m}</span>`)
      .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|default|from|async|await|new|typeof|instanceof|try|catch|finally|throw|switch|case|break|continue|of|in)\b/g,
        m => `<span class="text-violet-400 font-medium">${m}</span>`)
      .replace(/\b(true|false|null|undefined|NaN|Infinity)\b/g,
        m => `<span class="text-amber-400">${m}</span>`)
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        m => `<span class="text-green-400">${m}</span>`)
      .replace(/\b(\d+\.?\d*)\b/g, m => `<span class="text-sky-400">${m}</span>`)
      .replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, m => `<span class="text-cyan-300">${m}</span>`);
  }
  if (['py','python'].includes(l)) {
    return esc
      .replace(/#.*/g, m => `<span class="text-zinc-500 italic">${m}</span>`)
      .replace(/\b(def|class|import|from|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|try|except|finally|with|as|pass|break|continue|lambda|yield|global|nonlocal|del|assert|raise)\b/g,
        m => `<span class="text-violet-400 font-medium">${m}</span>`)
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|"""[\s\S]*?"""|'''[\s\S]*?''')/g,
        m => `<span class="text-green-400">${m}</span>`)
      .replace(/\b(\d+\.?\d*)\b/g, m => `<span class="text-sky-400">${m}</span>`);
  }
  if (['html','xml'].includes(l)) {
    return esc
      .replace(/(&lt;\/?[a-zA-Z][^&]*?&gt;)/g, m => `<span class="text-blue-400">${m}</span>`)
      .replace(/("(?:[^"\\]|\\.)*")/g, m => `<span class="text-green-400">${m}</span>`);
  }
  if (['sql'].includes(l)) {
    return esc
      .replace(/\b(SELECT|FROM|WHERE|JOIN|ON|INSERT|UPDATE|DELETE|CREATE|TABLE|INDEX|DROP|ALTER|ADD|SET|VALUES|INTO|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|INNER|LEFT|RIGHT|OUTER|FULL|CROSS|UNION|ALL|DISTINCT|AND|OR|NOT|NULL|IS|IN|LIKE|BETWEEN|EXISTS|COUNT|SUM|AVG|MAX|MIN)\b/gi,
        m => `<span class="text-violet-400 font-medium">${m.toUpperCase()}</span>`)
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => `<span class="text-green-400">${m}</span>`)
      .replace(/\b(\d+)\b/g, m => `<span class="text-sky-400">${m}</span>`);
  }
  if (['css','scss'].includes(l)) {
    return esc
      .replace(/([a-zA-Z-]+)\s*:/g, m => `<span class="text-sky-400">${m}</span>`)
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => `<span class="text-green-400">${m}</span>`)
      .replace(/(#[0-9a-fA-F]{3,8})\b/g, m => `<span class="text-amber-400">${m}</span>`);
  }
  return esc;
}

// Convert LaTeX-style math to a styled display
function MathBlock({ content, inline }) {
  if (inline) {
    return (
      <span className="inline-flex items-center mx-1 px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded text-violet-300 font-mono text-sm">
        {content}
      </span>
    );
  }
  return (
    <div className="my-3 p-4 bg-violet-500/8 border border-violet-500/20 rounded-xl overflow-x-auto">
      <div className="text-violet-200 font-mono text-sm text-center leading-relaxed whitespace-pre">
        {content}
      </div>
    </div>
  );
}

// Convert chemical formula subscripts: H2O → H₂O etc.
function formatChemical(text) {
  const subs = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
  const sups = {'+':'⁺','-':'⁻'};
  return text
    .replace(/([A-Z][a-z]?)(\d+)/g, (_, elem, num) => elem + [...num].map(d => subs[d]||d).join(''))
    .replace(/(\d+)([+-])/g, (_, num, sign) => [...num].map(d => sups[d]||d).join('') + (sups[sign]||sign));
}

// Detect chemical formula patterns (sequences of element symbols + numbers)
function looksChemical(text) {
  return /\b([A-Z][a-z]?\d*){2,}\b/.test(text) && /[A-Z][a-z]?[₀-₉\d]/.test(text.replace(/([A-Z][a-z]?)(\d+)/g, (_, e, n) => e + n));
}

// Parse and render AI message segments
function MessageRenderer({ text }) {
  const segments = [];
  let remaining = text;

  // Extract [IMAGE: prompt] blocks first
  const imgRegex = /\[IMAGE:\s*([\s\S]*?)\]/g;
  let lastIdx = 0;
  let match;
  const parts = [];
  while ((match = imgRegex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push({ type: 'text', content: text.slice(lastIdx, match.index) });
    parts.push({ type: 'image_tag', prompt: match[1].trim() });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push({ type: 'text', content: text.slice(lastIdx) });

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parts.map((part, pi) => {
        if (part.type === 'image_tag') {
          return <GeneratedImage key={pi} prompt={part.prompt} />;
        }
        return <TextSegments key={pi} text={part.content} />;
      })}
    </div>
  );
}

function GeneratedImage({ prompt }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const url = generateImageUrl(prompt);
  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/60 max-w-sm">
      {!loaded && !error && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          <span className="text-xs">Generating image…</span>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground p-4">
          <Image className="w-8 h-8 opacity-30" />
          <span className="text-xs text-center">Image generation unavailable. Check network.</span>
        </div>
      )}
      <img
        src={url}
        alt={prompt}
        className={`w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0 h-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {loaded && (
        <div className="px-3 py-2 bg-black/30 backdrop-blur-sm">
          <p className="text-[11px] text-muted-foreground truncate">{prompt}</p>
        </div>
      )}
    </div>
  );
}

function TextSegments({ text }) {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const mathBlockRegex = /\$\$([\s\S]*?)\$\$/g;
  const inlineMathRegex = /\$((?!\$)[^$\n]+?)\$/g;

  const allRanges = [];

  let m;
  const re1 = new RegExp(codeBlockRegex.source, 'g');
  while ((m = re1.exec(text)) !== null) {
    allRanges.push({ start: m.index, end: m.index + m[0].length, type: 'code', lang: m[1], content: m[2] });
  }
  const re2 = new RegExp(mathBlockRegex.source, 'g');
  while ((m = re2.exec(text)) !== null) {
    if (!allRanges.some(r => m.index >= r.start && m.index < r.end))
      allRanges.push({ start: m.index, end: m.index + m[0].length, type: 'math_block', content: m[1] });
  }
  const re3 = new RegExp(inlineMathRegex.source, 'g');
  while ((m = re3.exec(text)) !== null) {
    if (!allRanges.some(r => m.index >= r.start && m.index < r.end))
      allRanges.push({ start: m.index, end: m.index + m[0].length, type: 'math_inline', content: m[1] });
  }

  allRanges.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const range of allRanges) {
    if (range.start > cursor) segments.push({ type: 'prose', content: text.slice(cursor, range.start) });
    segments.push(range);
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ type: 'prose', content: text.slice(cursor) });

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'code') {
          return <CodeBlock key={i} lang={seg.lang} code={seg.content.trimEnd()} />;
        }
        if (seg.type === 'math_block') {
          return <MathBlock key={i} content={seg.content.trim()} />;
        }
        if (seg.type === 'math_inline') {
          return <MathBlock key={i} content={seg.content} inline />;
        }
        return <ProseRenderer key={i} text={seg.content} />;
      })}
    </>
  );
}

function CodeBlock({ lang, code }) {
  const highlighted = highlightCode(code, lang);
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/8 bg-zinc-950 shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[11px] text-zinc-400 font-mono uppercase tracking-wider">{lang || 'code'}</span>
        </div>
        <CopyButton text={code} />
      </div>
      <div className="overflow-x-auto">
        <pre className="p-4 text-xs font-mono leading-relaxed text-zinc-300 min-w-0">
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        </pre>
      </div>
    </div>
  );
}

// Renders prose: handles bold, italic, headers, lists, chemical formulas
function ProseRenderer({ text }) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headers
    if (/^### /.test(line)) {
      elements.push(<h4 key={i} className="text-sm font-bold text-foreground mt-3 mb-1">{renderInline(line.slice(4))}</h4>);
    } else if (/^## /.test(line)) {
      elements.push(<h3 key={i} className="text-base font-bold text-foreground mt-4 mb-2">{renderInline(line.slice(3))}</h3>);
    } else if (/^# /.test(line)) {
      elements.push(<h2 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{renderInline(line.slice(2))}</h2>);
    }
    // Horizontal rule
    else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-white/10 my-3" />);
    }
    // Unordered list
    else if (/^[-*•] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*•] /.test(lines[i])) {
        items.push(<li key={i} className="ml-4 text-foreground/90">{renderInline(lines[i].slice(2))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2">{items}</ul>);
      continue;
    }
    // Ordered list
    else if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i} className="ml-4 text-foreground/90">{renderInline(lines[i].replace(/^\d+\. /,''))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2">{items}</ol>);
      continue;
    }
    // Blockquote
    else if (/^> /.test(line)) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-violet-500/50 pl-3 my-2 text-muted-foreground italic">
          {renderInline(line.slice(2))}
        </blockquote>
      );
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    }
    // Regular paragraph line
    else {
      elements.push(<p key={i} className="text-foreground/90 leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }

  return <>{elements}</>;
}

function renderInline(text) {
  // Split by bold (**), italic (*), inline code (`), and chemical formulas
  const parts = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', val: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('**')) parts.push({ type: 'bold', val: tok.slice(2, -2) });
    else if (tok.startsWith('*')) parts.push({ type: 'italic', val: tok.slice(1, -1) });
    else if (tok.startsWith('`')) parts.push({ type: 'code', val: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ type: 'text', val: text.slice(last) });

  return parts.map((p, i) => {
    if (p.type === 'bold') return <strong key={i} className="font-semibold text-foreground">{p.val}</strong>;
    if (p.type === 'italic') return <em key={i} className="italic text-foreground/80">{p.val}</em>;
    if (p.type === 'code') return (
      <code key={i} className="px-1.5 py-0.5 bg-zinc-800 border border-white/10 rounded text-[11px] font-mono text-violet-300">
        {p.val}
      </code>
    );
    return <span key={i}>{p.val}</span>;
  });
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const CloudAIPage = () => {
  const navigate  = useNavigate();
  const { toast } = useToast();

  const WELCOME_MSG = {
    role: 'ai',
    text: `Hello! I'm **Cloud AI**, the official AI assistant of **CloudCampus** — a product of **Axion Enterprise**.\n\nI can help you with:\n- 📚 How to use the CloudCampus platform\n- 🧮 Mathematics with full step-by-step solutions\n- ⚗️ Chemistry formulas and reactions\n- 💻 Code in any language\n- 🖼️ Generating images\n- 📝 Writing, essays, lesson plans, and more\n\nWhat would you like to explore today?`,
  };

  const [messages,    setMessages]    = useState([WELCOME_MSG]);
  const [inputValue,  setInputValue]  = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [streamText,  setStreamText]  = useState('');
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [inputValue]);

  const sendMessage = useCallback(async (userText) => {
    const text = (userText || inputValue).trim();
    if (!text || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInputValue('');
    setIsLoading(true);
    setStreamText('');

    try {
      if (!GROQ_API_KEY) throw new Error('VITE_GROQ_API_KEY is not set in your environment variables.');

      // Build conversation history
      const history = messages
        .filter(m => m.text && m.text !== WELCOME_MSG.text)
        .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: text },
      ];

      // ── Streaming fetch ──────────────────────────────────────────────────
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: apiMessages,
          max_tokens: 2048,
          temperature: 0.72,
          stream: true,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err?.error?.message || '';
        if (response.status === 401) throw new Error('Invalid API key. Check VITE_GROQ_API_KEY in Vercel.');
        if (response.status === 429) throw new Error('Rate limit hit. Please wait a moment and try again.');
        throw new Error(msg || `API error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta?.content || '';
            fullText += delta;
            setStreamText(fullText);
          } catch (_) {}
        }
      }

      setStreamText('');
      setMessages(prev => [...prev, { role: 'ai', text: fullText }]);

    } catch (err) {
      console.error('Cloud AI error:', err);
      toast({ variant: 'destructive', title: 'Cloud AI Error', description: err.message });
      setMessages(prev => [...prev, { role: 'ai', text: `⚠️ ${err.message}` }]);
      setStreamText('');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, isLoading, messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([WELCOME_MSG]);
    setStreamText('');
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <>
      <Helmet><title>Cloud AI — Axion Enterprise</title></Helmet>

      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">

        {/* Atmospheric background */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-60 -right-60 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] bg-indigo-500/6 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 right-1/3 w-[400px] h-[400px] bg-purple-500/6 rounded-full blur-[100px]" />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.015]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          />
        </div>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-background/70 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
              <ChevronLeft className="w-5 h-5" />
            </Button>

            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-base leading-none bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400">
                    Cloud AI
                  </h1>
                  <span className="text-[9px] bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide">Beta</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">by Axion Enterprise · Llama 3.3</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/20 border border-white/5 rounded-full px-3 py-1.5">
              <Building2 className="w-3 h-3" />
              Axion Enterprise
            </div>
            <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground hover:text-red-400 rounded-lg h-8 px-3 text-xs gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
        </header>

        {/* ── Messages ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-5 pb-4">

            {/* Suggestions — only when fresh */}
            {messages.length === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6"
              >
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => sendMessage(s.label)}
                    className="group flex items-start gap-2.5 p-3 rounded-xl border border-white/6 bg-card/40 hover:bg-card/80 hover:border-white/12 transition-all text-left hover:scale-[1.02] active:scale-95"
                  >
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0 shadow-sm`}>
                      <s.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-snug mt-0.5">{s.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Message list */}
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} msg={msg} />
              ))}
            </AnimatePresence>

            {/* Streaming bubble */}
            {isLoading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 justify-start">
                <AIAvatar />
                <div className="flex-1 max-w-[85%] sm:max-w-[78%] bg-card/70 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  {streamText ? (
                    <div className="text-sm leading-relaxed">
                      <MessageRenderer text={streamText} />
                      <span className="inline-block w-1.5 h-4 bg-violet-500 rounded-sm ml-1 animate-pulse align-text-bottom" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 h-5">
                      <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input ──────────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-transparent pt-6 pb-4 px-3 sm:px-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 p-2 bg-card/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl focus-within:border-violet-500/40 focus-within:shadow-violet-500/10 transition-all duration-200">

              {/* Sparkle icon */}
              <div className="pl-2 pb-1.5 shrink-0">
                <Zap className="w-4 h-4 text-violet-500/70" />
              </div>

              {/* Textarea — grows with content */}
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything — math, code, chemistry, platform help, generate images…"
                className="flex-1 bg-transparent resize-none border-none outline-none text-sm placeholder:text-muted-foreground/50 py-2 pr-1 min-h-[40px] max-h-[160px] leading-relaxed"
                disabled={isLoading}
                rows={1}
                autoComplete="off"
              />

              {/* Send */}
              <Button
                onClick={() => sendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25 shrink-0 p-0 disabled:opacity-30 transition-all"
              >
                {isLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4 ml-0.5" />
                }
              </Button>
            </div>

            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-[10px] text-muted-foreground/50">
                Enter to send · Shift+Enter for new line
              </p>
              <p className="text-[10px] text-muted-foreground/40">
                Cloud AI by Axion Enterprise
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────
function AIAvatar() {
  return (
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-violet-500/20 shrink-0 mt-1">
      <Sparkles className="w-4 h-4 text-white" />
    </div>
  );
}

function MessageBubble({ msg }) {
  const isAi = msg.role === 'ai';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}
    >
      {isAi && <AIAvatar />}

      <div className={`
        max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-3 shadow-sm
        ${isAi
          ? 'bg-card/70 border border-white/8 rounded-tl-sm'
          : 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm shadow-lg shadow-violet-500/15'
        }
      `}>
        {isAi
          ? <MessageRenderer text={msg.text} />
          : <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
        }
      </div>

      {!isAi && (
        <div className="w-8 h-8 rounded-xl bg-zinc-700/80 border border-white/10 flex items-center justify-center shrink-0 mt-1">
          <User className="w-4 h-4 text-zinc-300" />
        </div>
      )}
    </motion.div>
  );
}

export default CloudAIPage;
