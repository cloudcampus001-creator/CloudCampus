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
// 3. Get your free key at https://console.groq.com  (no credit card needed) yup
// ─────────────────────────────────────────────────────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const MODEL   = 'llama-3.3-70b-versatile'; // free, fast, very smart
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT =
  'You are Cloud AI, a helpful assistant built into the CloudCampus school management platform. ' +
  'You assist teachers, vice principals, discipline masters, administrators, and parents with ' +
  'school-related questions, administrative tasks, lesson planning, and general queries. ' +
  'Be concise, friendly, and professional.';

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