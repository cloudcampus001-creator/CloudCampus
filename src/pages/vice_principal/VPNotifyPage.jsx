import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import PageTransition from '@/components/PageTransition';

const VPNotifyPage = ({ selectedClass }) => {
  const { toast } = useToast();
  const { t }     = useLanguage();

  const [loading,  setLoading]  = useState(false);
  const [title,    setTitle]    = useState('');
  const [content,  setContent]  = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass) {
      toast({ variant: 'destructive', title: t('error'), description: t('vpNotifyNoClassToast') });
      return;
    }
    setLoading(true);
    try {
      const userName = localStorage.getItem('userName');
      const schoolId = localStorage.getItem('schoolId');
      const { error } = await supabase.from('notifications').insert([{
        sender_name: userName,
        sender_role: 'vice_principal',
        title,
        content,
        target_type: 'class',
        target_id:   parseInt(selectedClass),
        school_id:   parseInt(schoolId),
        created_at:  new Date().toISOString(),
      }]);
      if (error) throw error;
      toast({ title: `✓ ${t('success')}`, description: t('vpNotifySent') });
      setTitle(''); setContent('');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: t('error'), description: t('vpNotifyError') });
    } finally { setLoading(false); }
  };

  return (
    <>
      <Helmet><title>{t('vpNotifyTitle')} · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
              {t('vpNotifyTitle')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('vpNotifyDesc')}</p>
          </motion.div>

          {/* No class selected */}
          {!selectedClass ? (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="glass rounded-2xl p-16 flex flex-col items-center text-center gap-4">
                <div className="p-5 rounded-3xl bg-purple-500/10">
                  <Bell className="h-10 w-10 text-purple-400 opacity-50" />
                </div>
                <div>
                  <p className="font-semibold text-base">{t('vpNotifyNoClass')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('selectClass')}</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="glass rounded-2xl p-7 space-y-6 border-t-2 border-t-purple-500/60">

                {/* Form header */}
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-purple-500/15">
                    <Bell className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">{t('vpNotifyCompose')}</h2>
                    <p className="text-xs text-muted-foreground">{t('vpNotifyComposeDesc')}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Audience pill (read-only) */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('vpNotifyAudience')}</Label>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/4 border border-white/10 text-sm text-muted-foreground">
                      <Bell className="h-4 w-4 text-purple-400 shrink-0" />
                      {t('vpNotifyAudienceValue')}
                      <span className="ml-auto px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 text-[10px] font-bold border border-purple-500/25">
                        {t('wholeClass')}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('vpNotifyTitleLabel')}</Label>
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Upcoming Exam Schedule"
                      className="bg-white/5 border-white/10 focus:border-purple-500/50 rounded-xl h-11"
                      required
                    />
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('vpNotifyContent')}</Label>
                    <Textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder={t('vpNotifyContentPlaceholder')}
                      className="bg-white/5 border-white/10 focus:border-purple-500/50 min-h-[150px] resize-none rounded-xl"
                      required
                    />
                  </div>

                  {/* Character hint */}
                  <p className="text-[11px] text-muted-foreground text-right">{content.length} chars</p>

                  <button
                    type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-base shadow-xl shadow-purple-500/25 transition-all active:scale-[0.98] disabled:opacity-60"
                  >
                    {loading
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> {t('submitting')}</>
                      : <><Send className="h-5 w-5" /> {t('vpNotifySend')}</>}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </div>
      </PageTransition>
    </>
  );
};

export default VPNotifyPage;
