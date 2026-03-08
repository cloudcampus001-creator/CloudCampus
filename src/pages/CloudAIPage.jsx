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

// ── Colour tokens — all inline styles so Tailwind purge never kills them ──────
const C = {
  keyword:  'color:#c792ea;font-weight:600',   // purple   — keywords
  builtin:  'color:#82aaff',                   // blue     — built-ins / types
  string:   'color:#c3e88d',                   // green    — strings
  number:   'color:#f78c6c',                   // orange   — numbers
  comment:  'color:#546e7a;font-style:italic', // grey     — comments
  tag:      'color:#f07178',                   // red      — HTML tags
  attr:     'color:#ffcb6b',                   // yellow   — attributes
  constant: 'color:#ff9cac',                   // pink     — booleans / null
  func:     'color:#82aaff',                   // blue     — function names
  classN:   'color:#ffcb6b',                   // yellow   — class names
  prop:     'color:#89ddff',                   // cyan     — CSS properties
  hex:      'color:#f78c6c',                   // orange   — hex colours
  operator: 'color:#89ddff',                   // cyan     — operators
  sql_kw:   'color:#c792ea;font-weight:600',   // purple   — SQL keywords
  sql_fn:   'color:#82aaff',                   // blue     — SQL functions
};
const s = (style, content) => `<span style="${style}">${content}</span>`;

function highlightCode(code, lang) {
  const esc = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const l   = (lang || '').toLowerCase();

  // ── JavaScript / TypeScript / JSX / TSX ─────────────────────────────────
  if (['js','javascript','jsx','ts','typescript','tsx'].includes(l)) {
    return esc
      // Comments first (protect from further replacement)
      .replace(/\/\/[^\n]*/g,         m => s(C.comment, m))
      .replace(/\/\*[\s\S]*?\*\//g,   m => s(C.comment, m))
      // Strings & template literals
      .replace(/(`(?:[^`\\]|\\.)*`)/g,                       m => s(C.string, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,     m => s(C.string, m))
      // Keywords
      .replace(/\b(const|let|var|function|return|if|else|for|while|do|class|extends|import|export|default|from|async|await|new|typeof|instanceof|try|catch|finally|throw|switch|case|break|continue|of|in|yield|static|get|set|super|this|delete|void|debugger)\b/g,
               m => s(C.keyword, m))
      // Boolean / null / undefined
      .replace(/\b(true|false|null|undefined|NaN|Infinity)\b/g, m => s(C.constant, m))
      // Numbers
      .replace(/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g,             m => s(C.number, m))
      // Class names (CamelCase)
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g,                  m => s(C.classN, m))
      // Function calls
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*\()/g,          m => s(C.func, m));
  }

  // ── Python ───────────────────────────────────────────────────────────────
  if (['py','python'].includes(l)) {
    return esc
      .replace(/#[^\n]*/g, m => s(C.comment, m))
      .replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g,            m => s(C.string, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,     m => s(C.string, m))
      .replace(/\b(def|class|import|from|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|try|except|finally|with|as|pass|break|continue|lambda|yield|global|nonlocal|del|assert|raise|async|await)\b/g,
               m => s(C.keyword, m))
      .replace(/\b(print|len|range|int|str|float|list|dict|set|tuple|bool|type|input|open|enumerate|zip|map|filter|sorted|reversed|sum|min|max|abs|round)\b/g,
               m => s(C.builtin, m))
      .replace(/\b(\d+\.?\d*)\b/g, m => s(C.number, m))
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g, m => s(C.classN, m))
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── HTML / XML ───────────────────────────────────────────────────────────
  if (['html','xml','jsx-html'].includes(l)) {
    return esc
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g,  m => s(C.comment, m))
      .replace(/(&lt;\/?)([\w:-]+)/g,
        (_, bracket, tag) => s(C.operator, bracket) + s(C.tag, tag))
      .replace(/([\w:-]+)(=)/g,
        (_, attr, eq) => s(C.attr, attr) + s(C.operator, eq))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/(&gt;)/g, m => s(C.operator, m));
  }

  // ── CSS / SCSS ───────────────────────────────────────────────────────────
  if (['css','scss','less'].includes(l)) {
    return esc
      .replace(/(\/\*[\s\S]*?\*\/)/g,      m => s(C.comment, m))
      .replace(/(#[0-9a-fA-F]{3,8})\b/g,   m => s(C.hex, m))
      .replace(/(-?[\d.]+(?:px|em|rem|vh|vw|%|s|ms|deg|fr)?)\b/g, m => s(C.number, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/([a-zA-Z-]+)(\s*:)/g,
        (_, prop, colon) => s(C.prop, prop) + s(C.operator, colon))
      .replace(/([@&.#:[\]])([a-zA-Z0-9_-]*)/g,
        (_, sym, name) => s(C.keyword, sym) + s(C.classN, name));
  }

  // ── SQL ──────────────────────────────────────────────────────────────────
  if (['sql'].includes(l)) {
    return esc
      .replace(/--[^\n]*/g, m => s(C.comment, m))
      .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|INSERT|INTO|UPDATE|DELETE|CREATE|TABLE|INDEX|DROP|ALTER|ADD|SET|VALUES|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|UNION|ALL|DISTINCT|AND|OR|NOT|NULL|IS|IN|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|END|WITH|RETURNING)\b/gi,
               m => s(C.sql_kw, m.toUpperCase()))
      .replace(/\b(COUNT|SUM|AVG|MAX|MIN|COALESCE|NULLIF|CAST|NOW|DATE|LOWER|UPPER|LENGTH|TRIM|CONCAT|ROUND|FLOOR|CEIL)\b/gi,
               m => s(C.sql_fn, m.toUpperCase()))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(\d+)\b/g, m => s(C.number, m));
  }

  // ── Bash / Shell ─────────────────────────────────────────────────────────
  if (['bash','sh','shell','zsh'].includes(l)) {
    return esc
      .replace(/#[^\n]*/g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|in|echo|export|source|cd|ls|mkdir|rm|cp|mv|grep|sed|awk|chmod|sudo|apt|npm|pip|git)\b/g,
               m => s(C.keyword, m))
      .replace(/\$[\w{][^}\s]*/g, m => s(C.builtin, m))
      .replace(/\b(\d+)\b/g, m => s(C.number, m));
  }

  // ── JSON ─────────────────────────────────────────────────────────────────
  if (['json'].includes(l)) {
    return esc
      .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g,
        (_, key, colon) => s(C.prop, key) + s(C.operator, colon))
      .replace(/("(?:[^"\\]|\\.)*")/g, m => s(C.string, m))
      .replace(/\b(true|false|null)\b/g, m => s(C.constant, m))
      .replace(/\b(\d+\.?\d*)\b/g, m => s(C.number, m));
  }

  // ── C ────────────────────────────────────────────────────────────────────
  if (['c'].includes(l)) {
    return esc
      .replace(/\/\/[^\n]*/g, m => s(C.comment, m))
      .replace(/\/\*[\s\S]*?\*\//g, m => s(C.comment, m))
      .replace(/(#\s*(?:include|define|ifdef|ifndef|endif|pragma|undef|if|else|elif)[^\n]*)/g, m => s(C.attr, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(int|char|float|double|long|short|unsigned|signed|void|struct|union|enum|typedef|const|static|extern|register|volatile|auto|sizeof|return|if|else|for|while|do|switch|case|break|continue|default|goto|NULL)\b/g, m => s(C.keyword, m))
      .replace(/\b([A-Z_][A-Z0-9_]{2,})\b/g, m => s(C.constant, m))
      .replace(/\b(\d+\.?\d*(?:[uUlLfF])*)\b/g, m => s(C.number, m))
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── C++ ──────────────────────────────────────────────────────────────────
  if (['cpp','c++','cxx','cc','hpp'].includes(l)) {
    return esc
      .replace(/\/\/[^\n]*/g, m => s(C.comment, m))
      .replace(/\/\*[\s\S]*?\*\//g, m => s(C.comment, m))
      .replace(/(#\s*(?:include|define|ifdef|ifndef|endif|pragma|undef|if|else|elif)[^\n]*)/g, m => s(C.attr, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(int|char|float|double|long|short|unsigned|signed|void|bool|auto|struct|class|union|enum|typedef|const|static|extern|volatile|inline|virtual|override|final|explicit|constexpr|noexcept|nullptr|template|typename|namespace|using|public|private|protected|new|delete|this|return|if|else|for|while|do|switch|case|break|continue|default|try|catch|throw|true|false|sizeof|decltype|static_cast|dynamic_cast|reinterpret_cast|const_cast)\b/g,
               m => s(C.keyword, m))
      .replace(/\b(std|cout|cin|endl|string|vector|map|set|pair|array|queue|stack|iostream|fstream|sstream)\b/g, m => s(C.builtin, m))
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g, m => s(C.classN, m))
      .replace(/\b(\d+\.?\d*(?:[uUlLfF])*)\b/g, m => s(C.number, m))
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── Java ─────────────────────────────────────────────────────────────────
  if (['java'].includes(l)) {
    return esc
      .replace(/\/\/[^\n]*/g, m => s(C.comment, m))
      .replace(/\/\*[\s\S]*?\*\//g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null|var|record|sealed|permits|yield)\b/g,
               m => s(C.keyword, m))
      .replace(/\b(System|String|Integer|Double|Boolean|List|ArrayList|Map|HashMap|Set|HashSet|Object|Math|Arrays|Collections|Optional|Stream|IOException|Exception|RuntimeException|Override|Deprecated|SuppressWarnings)\b/g,
               m => s(C.builtin, m))
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g, m => s(C.classN, m))
      .replace(/@\w+/g, m => s(C.attr, m))
      .replace(/\b(\d+\.?\d*[lLfFdD]?)\b/g, m => s(C.number, m))
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── Rust ─────────────────────────────────────────────────────────────────
  if (['rust','rs'].includes(l)) {
    return esc
      .replace(/\/\/[^\n]*/g, m => s(C.comment, m))
      .replace(/\/\*[\s\S]*?\*\//g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*"|r#?"(?:[^"\\]|\\.)*"#?)/g, m => s(C.string, m))
      .replace(/\b(as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while|abstract|become|box|do|final|macro|override|priv|try|typeof|unsized|virtual|yield)\b/g,
               m => s(C.keyword, m))
      .replace(/\b(i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|String|Vec|Option|Result|Some|None|Ok|Err|Box|Rc|Arc|HashMap|HashSet|BTreeMap|BTreeSet|println|print|eprintln|format|panic|assert|todo|unimplemented)\b/g,
               m => s(C.builtin, m))
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g, m => s(C.classN, m))
      .replace(/'[a-z_][a-zA-Z0-9_]*/g, m => s(C.attr, m))  // lifetimes
      .replace(/\b(\d+\.?\d*(?:_?[iu]\d+|_?f\d+)?)\b/g, m => s(C.number, m))
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*[!?(])/g, m => s(C.func, m));
  }

  // ── Go ───────────────────────────────────────────────────────────────────
  if (['go','golang'].includes(l)) {
    return esc
      .replace(/\/\/[^\n]*/g, m => s(C.comment, m))
      .replace(/\/\*[\s\S]*?\*\//g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*"|`[\s\S]*?`)/g, m => s(C.string, m))
      .replace(/\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var|nil|true|false|iota)\b/g,
               m => s(C.keyword, m))
      .replace(/\b(int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|uintptr|float32|float64|complex64|complex128|byte|rune|string|bool|error|any|make|new|len|cap|append|copy|delete|close|panic|recover|print|println|fmt|os|io|net|http|json|sync|time|math|sort|strings|strconv|errors|context)\b/g,
               m => s(C.builtin, m))
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g, m => s(C.classN, m))
      .replace(/\b(\d+\.?\d*)\b/g, m => s(C.number, m))
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── PHP ──────────────────────────────────────────────────────────────────
  if (['php'].includes(l)) {
    return esc
      .replace(/\/\/[^\n]*/g, m => s(C.comment, m))
      .replace(/#[^\n]*/g, m => s(C.comment, m))
      .replace(/\/\*[\s\S]*?\*\//g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|or|print|private|protected|public|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|yield|true|false|null)\b/gi,
               m => s(C.keyword, m))
      .replace(/\$[a-zA-Z_][a-zA-Z0-9_]*/g, m => s(C.builtin, m))
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g, m => s(C.classN, m))
      .replace(/\b(\d+\.?\d*)\b/g, m => s(C.number, m))
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── Ruby ─────────────────────────────────────────────────────────────────
  if (['ruby','rb'].includes(l)) {
    return esc
      .replace(/#[^\n]*/g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(BEGIN|END|alias|and|begin|break|case|class|def|defined\?|do|else|elsif|end|ensure|false|for|if|in|module|next|nil|not|or|redo|rescue|retry|return|self|super|then|true|undef|unless|until|when|while|yield|require|require_relative|include|extend|attr_accessor|attr_reader|attr_writer|puts|print|raise|p)\b/g,
               m => s(C.keyword, m))
      .replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, m => s(C.constant, m))  // symbols
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g, m => s(C.classN, m))
      .replace(/@{1,2}[a-zA-Z_][a-zA-Z0-9_]*/g, m => s(C.attr, m)) // instance/class vars
      .replace(/\b(\d+\.?\d*)\b/g, m => s(C.number, m))
      .replace(/\b([a-z_][a-zA-Z0-9_?!]*)(?=\s*[({])/g, m => s(C.func, m));
  }

  // ── Kotlin ───────────────────────────────────────────────────────────────
  if (['kotlin','kt','kts'].includes(l)) {
    return esc
      .replace(/\/\/[^\n]*/g, m => s(C.comment, m))
      .replace(/\/\*[\s\S]*?\*\//g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*"|"""[\s\S]*?""")/g, m => s(C.string, m))
      .replace(/\b(abstract|actual|annotation|as|break|by|catch|class|companion|const|constructor|continue|crossinline|data|do|dynamic|else|enum|expect|external|false|final|finally|for|fun|get|if|import|in|infix|init|inline|inner|interface|internal|is|it|lateinit|noinline|null|object|open|operator|out|override|package|private|protected|public|reified|return|sealed|set|super|suspend|tailrec|this|throw|true|try|typealias|typeof|val|var|vararg|when|where|while)\b/g,
               m => s(C.keyword, m))
      .replace(/\b(Int|Long|Short|Byte|Double|Float|Boolean|Char|String|Any|Unit|Nothing|List|MutableList|Map|MutableMap|Set|MutableSet|Array|Pair|Triple|println|print|TODO|also|apply|let|run|with|takeIf|takeUnless|forEach|map|filter|reduce|fold)\b/g,
               m => s(C.builtin, m))
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g, m => s(C.classN, m))
      .replace(/@\w+/g, m => s(C.attr, m))
      .replace(/\b(\d+\.?\d*[LlFf]?)\b/g, m => s(C.number, m))
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── Swift ────────────────────────────────────────────────────────────────
  if (['swift'].includes(l)) {
    return esc
      .replace(/\/\/[^\n]*/g, m => s(C.comment, m))
      .replace(/\/\*[\s\S]*?\*\//g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*")/g, m => s(C.string, m))
      .replace(/\b(as|associatedtype|break|case|catch|class|continue|default|defer|deinit|do|else|enum|extension|fallthrough|false|fileprivate|final|for|func|get|guard|if|import|in|init|inout|internal|is|lazy|let|mutating|nil|nonmutating|open|operator|optional|override|postfix|precedencegroup|prefix|private|protocol|public|repeat|required|rethrows|return|self|Self|set|some|static|struct|subscript|super|switch|throw|throws|true|try|typealias|unowned|var|weak|where|while|async|await|actor|nonisolated|isolated|convenience|dynamic|indirect|willSet|didSet)\b/g,
               m => s(C.keyword, m))
      .replace(/\b(Int|Int8|Int16|Int32|Int64|UInt|UInt8|UInt16|UInt32|UInt64|Float|Double|Bool|String|Character|Array|Dictionary|Set|Optional|Void|Never|Any|AnyObject|print|fatalError|precondition|assert|debugPrint|dump|type|Mirror|Codable|Equatable|Hashable|Comparable|Identifiable|ObservableObject|Published|State|Binding|View|Text|Image|Button|VStack|HStack|ZStack)\b/g,
               m => s(C.builtin, m))
      .replace(/\b([A-Z][a-zA-Z0-9_]+)\b/g, m => s(C.classN, m))
      .replace(/@\w+/g, m => s(C.attr, m))
      .replace(/\b(\d+\.?\d*)\b/g, m => s(C.number, m))
      .replace(/\b([a-z_][a-zA-Z0-9_]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── YAML ─────────────────────────────────────────────────────────────────
  if (['yaml','yml'].includes(l)) {
    return esc
      .replace(/#[^\n]*/g, m => s(C.comment, m))
      .replace(/^(\s*)([\w-]+)(\s*:)/gm,
        (_, indent, key, colon) => indent + s(C.prop, key) + s(C.operator, colon))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(true|false|null|yes|no|on|off)\b/gi, m => s(C.constant, m))
      .replace(/\b(\d+\.?\d*)\b/g, m => s(C.number, m))
      .replace(/^(\s*-\s)/gm, m => s(C.keyword, m))
      .replace(/^---/gm, m => s(C.attr, m));
  }

  // ── Markdown ─────────────────────────────────────────────────────────────
  if (['md','markdown'].includes(l)) {
    return esc
      .replace(/^(#{1,6}\s.*)/gm, m => s(C.classN, m))
      .replace(/(\*\*.*?\*\*|__.*?__)/g, m => s('font-weight:700;color:#e2e8f0', m))
      .replace(/(\*.*?\*|_.*?_)/g, m => s('font-style:italic;color:#e2e8f0', m))
      .replace(/(`[^`]+`)/g, m => s(C.string, m))
      .replace(/(\[.*?\]\(.*?\))/g, m => s(C.builtin, m))
      .replace(/^(\s*[-*+]\s)/gm, m => s(C.keyword, m))
      .replace(/^(\s*\d+\.\s)/gm, m => s(C.keyword, m))
      .replace(/^(>.*)/gm, m => s(C.comment, m));
  }

  // ── Dockerfile ───────────────────────────────────────────────────────────
  if (['dockerfile','docker'].includes(l)) {
    return esc
      .replace(/^#[^\n]*/gm, m => s(C.comment, m))
      .replace(/^(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)\b/gm,
               m => s(C.keyword, m))
      .replace(/("(?:[^"\\]|\\.)*")/g, m => s(C.string, m))
      .replace(/\$\{?[\w]+\}?/g, m => s(C.builtin, m));
  }

  // ── R ────────────────────────────────────────────────────────────────────
  if (['r'].includes(l)) {
    return esc
      .replace(/#[^\n]*/g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(if|else|for|while|repeat|break|next|return|function|in|TRUE|FALSE|NULL|NA|NA_integer_|NA_real_|NA_complex_|NA_character_|Inf|NaN|T|F)\b/g,
               m => s(C.keyword, m))
      .replace(/\b(c|list|data\.frame|matrix|array|vector|factor|library|require|source|print|cat|paste|paste0|sprintf|format|nchar|substr|toupper|tolower|gsub|sub|grep|grepl|strsplit|which|length|nrow|ncol|dim|sum|mean|sd|var|min|max|range|seq|rep|sample|set\.seed|apply|lapply|sapply|tapply|Map|Reduce|Filter|ggplot|aes|geom_point|geom_line|geom_bar|dplyr|tidyr|readr|tibble|mutate|filter|select|group_by|summarise|arrange|join)\b/g,
               m => s(C.builtin, m))
      .replace(/\b(\d+\.?\d*(?:[eE][+-]?\d+)?L?)\b/g, m => s(C.number, m))
      .replace(/\b([a-zA-Z.][a-zA-Z0-9._]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── MATLAB / Octave ───────────────────────────────────────────────────────
  if (['matlab','m','octave'].includes(l)) {
    return esc
      .replace(/%[^\n]*/g, m => s(C.comment, m))
      .replace(/\.\.\.[^\n]*/g, m => s(C.comment, m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => s(C.string, m))
      .replace(/\b(break|case|catch|continue|do|else|elseif|end|for|function|global|if|otherwise|parfor|persistent|return|spmd|switch|try|while|true|false|classdef|enumeration|events|methods|properties|true|false)\b/g,
               m => s(C.keyword, m))
      .replace(/\b(zeros|ones|eye|rand|randn|linspace|logspace|diag|repmat|reshape|size|length|numel|sum|prod|min|max|mean|std|var|sort|unique|find|ismember|intersect|union|plot|figure|subplot|xlabel|ylabel|title|legend|grid|hold|sprintf|fprintf|printf|disp|input|fopen|fclose|fread|fwrite|xlsread|xlswrite|csvread|csvwrite)\b/g,
               m => s(C.builtin, m))
      .replace(/\b(\d+\.?\d*(?:[eE][+-]?\d+)?[ij]?)\b/g, m => s(C.number, m))
      .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/g, m => s(C.func, m));
  }

  // ── TypeScript types / generics fallthrough handled by JS block above ────
  return esc;
}

// ─── KaTeX LOADER ────────────────────────────────────────────────────────────
// Dynamically injects KaTeX CSS + JS from CDN once, then resolves
const KATEX_VERSION = '0.16.9';
let katexReady = null; // singleton promise

function loadKaTeX() {
  if (katexReady) return katexReady;
  katexReady = new Promise((resolve) => {
    // CSS
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id   = 'katex-css';
      link.rel  = 'stylesheet';
      link.href = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
      document.head.appendChild(link);
    }
    // JS — only if not already there
    if (window.katex) { resolve(window.katex); return; }
    const script  = document.createElement('script');
    script.src    = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`;
    script.async  = true;
    script.onload = () => resolve(window.katex);
    script.onerror = () => resolve(null); // fail silently
    document.head.appendChild(script);
  });
  return katexReady;
}

// ─── MathBlock — renders real LaTeX via KaTeX ─────────────────────────────────
function MathBlock({ content, inline }) {
  const [html, setHtml]   = useState('');
  const [ready, setReady] = useState(!!window.katex);

  useEffect(() => {
    if (!ready) {
      loadKaTeX().then(k => { if (k) setReady(true); });
    }
  }, []);

  useEffect(() => {
    if (!ready || !window.katex) return;
    try {
      const rendered = window.katex.renderToString(content, {
        displayMode: !inline,
        throwOnError: false,
        strict: false,
        trust: false,
        output: 'html',
        macros: { '\\R': '\\mathbb{R}', '\\N': '\\mathbb{N}', '\\Z': '\\mathbb{Z}' },
      });
      setHtml(rendered);
    } catch (e) {
      setHtml(`<span style="color:#fbbf24;font-family:monospace">${content}</span>`);
    }
  }, [content, inline, ready]);

  // Fallback while KaTeX loads
  if (!html) {
    const fallbackStyle = inline
      ? { background:'rgba(30,58,138,0.25)', border:'1px solid rgba(96,165,250,0.4)', color:'#93c5fd', fontFamily:'monospace', padding:'1px 8px', borderRadius:4, fontSize:'0.85rem', display:'inline' }
      : { background:'#0f172a', border:'1px solid rgba(96,165,250,0.3)', borderLeft:'3px solid #3b82f6', padding:'12px 16px', borderRadius:8, color:'#93c5fd', fontFamily:'monospace', textAlign:'center', overflowX:'auto', margin:'10px 0' };
    return <span style={fallbackStyle}>{content}</span>;
  }

  if (inline) {
    return (
      <span
        className="katex-inline mx-0.5"
        style={{ display:'inline', verticalAlign:'middle', background:'rgba(30,58,138,0.2)', border:'1px solid rgba(96,165,250,0.25)', borderRadius:4, padding:'0 4px' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      style={{ background:'#0c1628', border:'1px solid rgba(59,130,246,0.25)', borderLeft:'3px solid #3b82f6', borderRadius:12, padding:'20px 24px', margin:'12px 0', overflowX:'auto', boxShadow:'0 4px 24px rgba(0,0,30,0.5)' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
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

  // Lang → display label + accent color
  const langMeta = {
    js:         { label: 'JavaScript', color: '#f7df1e' },
    javascript: { label: 'JavaScript', color: '#f7df1e' },
    jsx:        { label: 'JSX',        color: '#61dafb' },
    ts:         { label: 'TypeScript', color: '#3178c6' },
    typescript: { label: 'TypeScript', color: '#3178c6' },
    tsx:        { label: 'TSX',        color: '#61dafb' },
    py:         { label: 'Python',     color: '#3572A5' },
    python:     { label: 'Python',     color: '#3572A5' },
    html:       { label: 'HTML',       color: '#e34c26' },
    xml:        { label: 'XML',        color: '#e34c26' },
    css:        { label: 'CSS',        color: '#563d7c' },
    scss:       { label: 'SCSS',       color: '#c6538c' },
    less:       { label: 'Less',       color: '#1d365d' },
    sql:        { label: 'SQL',        color: '#e38c00' },
    json:       { label: 'JSON',       color: '#cbcb41' },
    bash:       { label: 'Bash',       color: '#89e051' },
    sh:         { label: 'Shell',      color: '#89e051' },
    shell:      { label: 'Shell',      color: '#89e051' },
    zsh:        { label: 'Zsh',        color: '#89e051' },
    c:          { label: 'C',          color: '#555555' },
    cpp:        { label: 'C++',        color: '#f34b7d' },
    'c++':      { label: 'C++',        color: '#f34b7d' },
    cxx:        { label: 'C++',        color: '#f34b7d' },
    java:       { label: 'Java',       color: '#b07219' },
    rust:       { label: 'Rust',       color: '#dea584' },
    rs:         { label: 'Rust',       color: '#dea584' },
    go:         { label: 'Go',         color: '#00add8' },
    golang:     { label: 'Go',         color: '#00add8' },
    php:        { label: 'PHP',        color: '#4f5d95' },
    ruby:       { label: 'Ruby',       color: '#701516' },
    rb:         { label: 'Ruby',       color: '#701516' },
    kotlin:     { label: 'Kotlin',     color: '#7f52ff' },
    kt:         { label: 'Kotlin',     color: '#7f52ff' },
    swift:      { label: 'Swift',      color: '#f05138' },
    yaml:       { label: 'YAML',       color: '#cb171e' },
    yml:        { label: 'YAML',       color: '#cb171e' },
    md:         { label: 'Markdown',   color: '#083fa1' },
    markdown:   { label: 'Markdown',   color: '#083fa1' },
    dockerfile: { label: 'Dockerfile', color: '#384d54' },
    docker:     { label: 'Docker',     color: '#2496ed' },
    r:          { label: 'R',          color: '#198ce7' },
    matlab:     { label: 'MATLAB',     color: '#e16737' },
    m:          { label: 'MATLAB',     color: '#e16737' },
  };
  const meta = langMeta[(lang||'').toLowerCase()] || { label: lang || 'Code', color: '#abb2bf' };

  return (
    <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden', margin: '12px 0', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
      {/* Header bar */}
      <div style={{ background: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Traffic light dots */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
          </div>
          <span style={{ color: meta.color, fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {meta.label}
          </span>
        </div>
        <CopyButton text={code} />
      </div>
      {/* Code */}
      <div style={{ overflowX: 'auto' }}>
        <pre style={{ padding: '16px', margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace", fontSize: '12.5px', lineHeight: '1.7', color: '#abb2bf', tabSize: 2, minWidth: 0 }}>
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
      <Helmet>
        <title>Cloud AI — Axion Enterprise</title>
        {/* KaTeX dark-navy theme */}
        <style>{`
          .katex { color: #bfdbfe !important; }
          .katex-display { color: #bfdbfe !important; }
          .katex-display > .katex { color: #bfdbfe !important; }
          .katex .mord, .katex .mbin, .katex .mrel, .katex .mop,
          .katex .mopen, .katex .mclose, .katex .mpunct { color: #bfdbfe !important; }
          .katex .mfrac .frac-line { border-color: #60a5fa !important; }
          .katex .sqrt > .sqrt-sign { color: #60a5fa !important; }
          .katex .accent > .accent-body { color: #60a5fa !important; }
        `}</style>
      </Helmet>

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
