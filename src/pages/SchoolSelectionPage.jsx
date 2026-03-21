/**
 * SchoolSelectionPage.jsx — Rebuilt
 * Premium full-bleed design — works in both light and dark mode.
 * Left panel: animated brand copy + floating stats card
 * Right panel: frosted glass search + school picker
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  School, ArrowRight, Loader2, Search,
  Cloud, Sparkles, Check, MapPin, Users, BookOpen,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Helmet } from 'react-helmet';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

/* ── animation presets ─────────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } };

/* ── school avatar with gradient based on name ─────────────── */
const Avatar = ({ name, size = 'md' }) => {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const sz = size === 'lg' ? 'h-12 w-12 rounded-2xl text-base' : 'h-10 w-10 rounded-xl text-sm';
  return (
    <div className={`${sz} flex items-center justify-center shrink-0 font-black text-white shadow-lg`}
      style={{ background: `linear-gradient(135deg,hsl(${hue},65%,55%),hsl(${(hue+45)%360},75%,62%))` }}>
      {initials || <School className="h-5 w-5" />}
    </div>
  );
};

const SchoolSelectionPage = () => {
  const navigate      = useNavigate();
  const { toast }     = useToast();
  const { t }         = useLanguage();

  const [schools,     setSchools]     = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [query,       setQuery]       = useState('');

  useEffect(() => {
    supabase.from('schools').select('*').order('name').then(({ data, error }) => {
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
    if (!selected) {
      toast({ variant: 'destructive', title: t('error'), description: t('selectSchoolFirst') });
      return;
    }
    navigate(`/role-selection/${selected.id}`);
  };

  return (
    <>
      <Helmet><title>{t('selectSchool')} · CloudCampus</title></Helmet>

      {/* ── Full-page layout — dark gradient always ─────────── */}
      <div className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#1e1b4b 100%)' }}>

        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle,#3b82f6,transparent 70%)' }} />
          <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle,#06b6d4,transparent 70%)' }} />
          <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle,#8b5cf6,transparent 70%)' }} />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.3) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        {/* ── Top bar ─────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-6 pt-6 relative z-10">
          <motion.button initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }} onClick={() => navigate('/')}
            className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}>
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight text-white">
              Cloud<span style={{ background: 'linear-gradient(90deg,#60a5fa,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Campus</span>
            </span>
          </motion.button>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }} className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </motion.div>
        </header>

        {/* ── Main content ────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
          <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-16 items-center">

            {/* ── LEFT: brand panel ─────────────────────────────── */}
            <motion.div initial={{ opacity: 0, x: -32 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="hidden lg:flex flex-col gap-8 text-white">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full w-fit text-xs font-semibold"
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
                <Sparkles className="h-3.5 w-3.5" />
                Smart School Management Platform
              </div>

              <div className="space-y-5">
                <h1 className="text-5xl font-black leading-[1.1] tracking-tight">
                  Your school,<br />
                  <span style={{ background: 'linear-gradient(90deg,#60a5fa,#22d3ee,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    one tap away.
                  </span>
                </h1>
                <p className="text-lg leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Select your institution to access your personalised dashboard — built for every role in your school.
                </p>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2">
                {['Administrators', 'Vice Principals', 'Teachers', 'Discipline Masters', 'Parents'].map(role => (
                  <span key={role} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {role}
                  </span>
                ))}
              </div>

              {/* Floating dashboard preview card */}
              <div className="relative mt-2 max-w-xs">
                <div className="rounded-2xl p-5 shadow-2xl"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}>
                      <School className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-white truncate">Collège Saint-Paul</p>
                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Yaoundé, Cameroun</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-emerald-400"
                      style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>LIVE</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[['480', 'Students', Users], ['36', 'Teachers', BookOpen], ['94%', 'Attendance', Check]].map(([v, l, Icon]) => (
                      <div key={l} className="rounded-xl py-2.5 text-center"
                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <p className="font-black text-base text-white">{v}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{l}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating AI badge */}
                <motion.div
                  animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="absolute -bottom-4 -right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg"
                  style={{ background: 'linear-gradient(135deg,#ec4899,#8b5cf6)', boxShadow: '0 4px 16px rgba(139,92,246,0.4)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Cloud AI Active
                </motion.div>
              </div>
            </motion.div>

            {/* ── RIGHT: selection card ──────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}>

              <div className="rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(24px)' }}>

                {/* Card top accent line */}
                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#3b82f6,#06b6d4,#8b5cf6)' }} />

                <div className="p-8">

                  {/* Header */}
                  <div className="mb-7">
                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.3),rgba(6,182,212,0.2))', border: '1px solid rgba(59,130,246,0.4)' }}>
                        <School className="h-6 w-6 text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{t('selectSchool')}</h2>
                        <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('selectSchoolSub')}</p>
                      </div>
                    </div>

                    {/* Count pill */}
                    {!loading && schools.length > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        {schools.length} {t('schoolsFound')}
                      </div>
                    )}
                  </div>

                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.35)' }} />
                    <input
                      type="text" value={query} onChange={e => setQuery(e.target.value)}
                      placeholder={t('searchSchoolPlaceholder')}
                      className="w-full pl-11 pr-4 h-12 rounded-xl text-sm text-white transition-all focus:outline-none placeholder:text-white/30"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                      onFocus={e => { e.target.style.border = '1px solid rgba(59,130,246,0.6)'; e.target.style.background = 'rgba(255,255,255,0.09)'; }}
                      onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.12)'; e.target.style.background = 'rgba(255,255,255,0.07)'; }}
                    />
                  </div>

                  {/* School list */}
                  <div className="rounded-2xl overflow-hidden mb-5"
                    style={{ maxHeight: '264px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-14 gap-3">
                        <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('loadingSchools')}</p>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-14 gap-3">
                        <School className="h-8 w-8 opacity-20 text-white" />
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('noSchoolsFound')}</p>
                      </div>
                    ) : (
                      <motion.div variants={stagger} initial="hidden" animate="visible">
                        {filtered.map((school, idx) => {
                          const isSelected = selected?.id === school.id;
                          return (
                            <motion.button key={school.id} variants={fadeUp}
                              onClick={() => setSelected(school)}
                              className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.99] group"
                              style={{
                                borderTop: idx !== 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                background: isSelected ? 'rgba(59,130,246,0.18)' : 'transparent',
                                borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                              }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <Avatar name={school.name} />

                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate"
                                  style={{ color: isSelected ? '#93c5fd' : 'rgba(255,255,255,0.9)' }}>
                                  {school.name}
                                </p>
                                {school.city && (
                                  <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    <MapPin className="h-2.5 w-2.5 shrink-0" />{school.city}
                                  </p>
                                )}
                              </div>

                              <AnimatePresence>
                                {isSelected && (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                                    <div className="h-6 w-6 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40"
                                      style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}>
                                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
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

                  {/* Selected preview strip */}
                  <AnimatePresence>
                    {selected && (
                      <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.22 }}>
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)' }}>
                          <Avatar name={selected.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Selected</p>
                            <p className="font-semibold text-sm text-white truncate mt-0.5">{selected.name}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'rgba(147,197,253,0.6)' }} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Continue button */}
                  <motion.button onClick={handleContinue}
                    whileHover={{ scale: selected ? 1.015 : 1 }}
                    whileTap={{ scale: selected ? 0.975 : 1 }}
                    disabled={!selected}
                    className="w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 text-white transition-all duration-200 relative overflow-hidden"
                    style={{
                      background: selected ? 'linear-gradient(135deg,#3b82f6,#06b6d4)' : 'rgba(255,255,255,0.06)',
                      border: selected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      boxShadow: selected ? '0 8px 32px rgba(59,130,246,0.4)' : 'none',
                      color: selected ? '#fff' : 'rgba(255,255,255,0.3)',
                      cursor: selected ? 'pointer' : 'not-allowed',
                    }}>
                    {/* Shimmer on hover */}
                    {selected && (
                      <span className="absolute inset-0 pointer-events-none"
                        style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)', transform: 'skewX(-20deg)', animation: 'shimmer 2.5s infinite', backgroundSize: '200% 100%' }} />
                    )}
                    <span className="relative">{t('continueBtn')}</span>
                    <ArrowRight className="h-5 w-5 relative" />
                  </motion.button>

                  {/* Trust footer */}
                  <div className="flex items-center justify-center gap-4 mt-5">
                    {['Secure', 'Bilingual EN/FR', 'Free'].map((label, i) => (
                      <span key={label} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Bottom copyright */}
        <p className="text-center pb-6 text-xs relative z-10" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © 2025 CloudCampus · Yaoundé, Cameroon 🇨🇲
        </p>
      </div>

      {/* Shimmer keyframe */}
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </>
  );
};

export default SchoolSelectionPage;
