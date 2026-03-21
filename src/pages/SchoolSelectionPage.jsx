/**
 * SchoolSelectionPage.jsx
 * The first screen users see after the landing page.
 * Full redesign: animated gradient mesh, floating stat cards,
 * live-search school list, glass card, spring transitions.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  School, ArrowRight, Loader2, Search, MapPin,
  Cloud, Sparkles, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Helmet } from 'react-helmet';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

/* ── helpers ────────────────────────────────────────────────── */
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* Elegant school initial avatar */
const SchoolAvatar = ({ name }) => {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  return (
    <div
      className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-xs shadow-sm"
      style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}
    >
      {initials || <School className="h-4 w-4" />}
    </div>
  );
};

const SchoolSelectionPage = () => {
  const navigate      = useNavigate();
  const { toast }     = useToast();
  const { t }         = useLanguage();

  const [schools,        setSchools]        = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [query,          setQuery]          = useState('');

  useEffect(() => {
    supabase.from('schools').select('*').order('name')
      .then(({ data, error }) => {
        if (error) toast({ variant: 'destructive', title: t('error'), description: error.message });
        setSchools(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() =>
    schools.filter(s => s.name.toLowerCase().includes(query.toLowerCase())),
    [schools, query]
  );

  const handleContinue = () => {
    if (!selectedSchool) {
      toast({ variant: 'destructive', title: t('error'), description: t('selectSchoolFirst') });
      return;
    }
    navigate(`/role-selection/${selectedSchool.id}`);
  };

  return (
    <>
      <Helmet><title>{t('selectSchool')} · CloudCampus</title></Helmet>

      {/* ── Full-bleed background ──────────────────────────────── */}
      <div className="min-h-screen bg-background font-sans overflow-hidden relative flex flex-col">

        {/* Gradient orbs */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-cyan-500/8 blur-[100px]" />
          <div className="absolute -bottom-60 left-1/3 w-[700px] h-[700px] rounded-full bg-indigo-600/8 blur-[140px]" />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.018]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.15) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        </div>

        {/* ── Top bar ───────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-6 pt-6 pb-2 relative z-10">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
            className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight">
              Cloud<span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-cyan-400">Campus</span>
            </span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
            className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </motion.div>
        </header>

        {/* ── Main two-column layout ────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">

            {/* ── Left: hero copy ───────────────────────────────── */}
            <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="hidden lg:flex flex-col gap-8">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold w-fit">
                <Sparkles className="h-3.5 w-3.5" />
                Smart School Management
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl font-black leading-[1.1] tracking-tight">
                  Your school,<br />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500">
                    one tap away.
                  </span>
                </h1>
                <p className="text-muted-foreground text-lg leading-relaxed max-w-sm">
                  Select your institution to access your personalised dashboard — parents, teachers, administration and more.
                </p>
              </div>

              {/* Floating mini dashboard card */}
              <div className="relative mt-2">
                <div className="glass rounded-2xl p-5 border border-white/10 shadow-2xl max-w-xs">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                      <School className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Collège Saint-Paul</p>
                      <p className="text-[11px] text-muted-foreground">Yaoundé, Cameroun</p>
                    </div>
                    <div className="ml-auto">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 font-bold">LIVE</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[['480','Élèves'],['36','Profs'],['94%','Présence']].map(([v,l]) => (
                      <div key={l} className="bg-white/5 rounded-xl py-2">
                        <p className="font-black text-base text-foreground">{v}</p>
                        <p className="text-[10px] text-muted-foreground">{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-3 -right-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-blue-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Cloud AI Active
                </div>
              </div>
            </motion.div>

            {/* ── Right: selection card ─────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}>

              <div className="glass rounded-3xl p-8 shadow-2xl border border-white/10 border-t-2 border-t-blue-500/70 relative overflow-hidden">
                {/* Subtle inner glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />

                {/* Header */}
                <div className="mb-7">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-400/15 border border-blue-500/25 flex items-center justify-center">
                      <School className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">{t('selectSchool')}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{t('selectSchoolSub')}</p>
                    </div>
                  </div>

                  {/* School count pill */}
                  {!loading && schools.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        <span className="font-semibold text-blue-400">{schools.length}</span> {t('schoolsFound')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={t('searchSchoolPlaceholder')}
                    className="w-full pl-10 pr-4 h-12 rounded-xl bg-white/5 border border-white/10 focus:border-blue-500/50 focus:bg-white/8 focus:outline-none text-sm transition-all placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* School list */}
                <div className="rounded-2xl border border-white/8 overflow-hidden bg-white/[0.02] mb-6"
                  style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
                      <p className="text-sm text-muted-foreground">{t('loadingSchools')}</p>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <School className="h-8 w-8 text-muted-foreground opacity-25" />
                      <p className="text-sm text-muted-foreground">{t('noSchoolsFound')}</p>
                    </div>
                  ) : (
                    <motion.div variants={stagger} initial="hidden" animate="visible">
                      {filtered.map((school, idx) => {
                        const isSelected = selectedSchool?.id === school.id;
                        return (
                          <motion.button
                            key={school.id}
                            variants={fadeUp}
                            onClick={() => setSelectedSchool(school)}
                            className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.99] ${
                              idx !== 0 ? 'border-t border-white/5' : ''
                            } ${isSelected
                                ? 'bg-blue-500/15 border-l-2 border-l-blue-400'
                                : 'hover:bg-white/5'
                            }`}
                          >
                            <SchoolAvatar name={school.name} />
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm truncate ${isSelected ? 'text-blue-300' : ''}`}>
                                {school.name}
                              </p>
                              {school.city && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  {school.city}
                                </p>
                              )}
                            </div>
                            <AnimatePresence>
                              {isSelected && (
                                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                                  <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/40">
                                    <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}
                </div>

                {/* Selected school preview */}
                <AnimatePresence>
                  {selectedSchool && (
                    <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.25 }}>
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
                        <SchoolAvatar name={selectedSchool.name} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">{t('selectedClass')}</p>
                          <p className="font-semibold truncate text-sm mt-0.5">{selectedSchool.name}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-blue-400/50 shrink-0" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CTA */}
                <motion.button
                  onClick={handleContinue}
                  whileHover={{ scale: selectedSchool ? 1.01 : 1 }}
                  whileTap={{ scale: selectedSchool ? 0.98 : 1 }}
                  disabled={!selectedSchool}
                  className="w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selectedSchool
                      ? 'linear-gradient(135deg, #3b82f6, #06b6d4)'
                      : undefined,
                    boxShadow: selectedSchool ? '0 8px 32px rgba(59,130,246,0.35)' : undefined,
                  }}
                >
                  <span>{t('continueBtn')}</span>
                  <ArrowRight className="h-5 w-5" />
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SchoolSelectionPage;