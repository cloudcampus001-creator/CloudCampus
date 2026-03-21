import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Mail, Send, MapPin, Phone, CheckCircle2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Helmet } from 'react-helmet';

const WEB3FORMS_KEY = 'd3194771-5f79-40bd-8b4d-cb6d3e8e44b9';

const ContactUsPage = () => {
  const navigate  = useNavigate();
  const { t }     = useLanguage();
  const { toast } = useToast();

  const [form,    setForm]    = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          name:       form.name,
          email:      form.email,
          message:    form.message,
          subject:    `CloudCampus contact from ${form.name}`,
          from_name:  'CloudCampus Contact Page',
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSent(true);
        setForm({ name: '', email: '', message: '' });
        toast({
          title: '✓ ' + t('success'),
          description: t('contactSuccess'),
          className: 'bg-green-500/10 border-green-500/50 text-green-400',
        });
      } else {
        throw new Error(data.message || 'Submission failed');
      }
    } catch (err) {
      const msg = err.message || 'Network error. Please try again.';
      setError(msg);
      toast({ variant: 'destructive', title: t('error'), description: msg });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('contactUs')} - CloudCampus</title>
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
        {/* Background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-3xl -z-10" />

        <div className="p-6">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" /> {t('back')}
          </button>
        </div>

        <div className="max-w-5xl mx-auto w-full px-6 pb-20 grid md:grid-cols-2 gap-12 items-start">

          {/* ── Info side ── */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
            className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
                {t('getInTouch')}
              </h1>
              <p className="text-muted-foreground text-lg">{t('contactDesc')}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-white/5">
                <MapPin className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">Headquarters</h3>
                  <p className="text-sm text-muted-foreground">Mendong, Yaoundé — Cameroon 🇨🇲</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-white/5">
                <Mail className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">Email</h3>
                  <p className="text-sm text-muted-foreground">cloudcampus001@gmail.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-white/5">
                <Phone className="w-5 h-5 text-pink-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">Phone / WhatsApp</h3>
                  <p className="text-sm text-muted-foreground">+237 654 84 05 42</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-white/5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">Response time</h3>
                  <p className="text-sm text-muted-foreground">Within 24 hours</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Form side ── */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-card/30 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">

            {sent ? (
              /* Success state */
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center py-10 gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Message sent!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    We'll reply to <span className="font-semibold text-foreground">{form.email || 'your email'}</span> within 24 hours.
                  </p>
                </div>
                <button onClick={() => setSent(false)}
                  className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2">
                  Send another message
                </button>
              </motion.div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="font-bold text-lg mb-1">{t('sendMessage')}</h2>

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('name')}
                  </Label>
                  <Input
                    id="name" required
                    placeholder="Jean Dupont"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="h-11 bg-background/50 border-white/10 rounded-xl focus:border-indigo-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('email')}
                  </Label>
                  <Input
                    id="email" type="email" required
                    placeholder="you@school.cm"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className="h-11 bg-background/50 border-white/10 rounded-xl focus:border-indigo-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('message')}
                  </Label>
                  <Textarea
                    id="message" required
                    placeholder="How can we help your school?"
                    className="min-h-[140px] bg-background/50 border-white/10 rounded-xl focus:border-indigo-500/50 resize-none"
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending || !form.name || !form.email || !form.message}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}
                >
                  {sending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                    : <><Send className="h-4 w-4" /> {t('sendMessage')}</>}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  Message goes directly to cloudcampus001@gmail.com
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ContactUsPage;
