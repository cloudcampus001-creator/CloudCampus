/**
 * RoleSelectionPage.jsx
 * Full redesign: asymmetric hero layout, large animated role cards,
 * per-role gradient glow, full translation via t().
 */
import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, GraduationCap, Shield, Key, ArrowLeft,
  Cloud, UserCheck, ArrowRight,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};
const cardVariant = {
  hidden: { opacity: 0, y: 28, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

const RoleSelectionPage = () => {
  const { schoolId } = useParams();
  const navigate     = useNavigate();
  const { t }        = useLanguage();

  const roles = [
    {
      id: 'parent', titleKey: 'role_parent', descKey: 'roleDesc_parent',
      icon: User,
      from: '#3b82f6', to: '#06b6d4', glow: 'rgba(59,130,246,0.30)',
      hoverBorder: 'hover:border-blue-500/50', activeBg: 'rgba(59,130,246,0.08)',
      path: `/login/parent/${schoolId}`,
    },
    {
      id: 'teacher', titleKey: 'role_teacher', descKey: 'roleDesc_teacher',
      icon: GraduationCap,
      from: '#10b981', to: '#14b8a6', glow: 'rgba(16,185,129,0.30)',
      hoverBorder: 'hover:border-emerald-500/50', activeBg: 'rgba(16,185,129,0.08)',
      path: `/login/teacher/${schoolId}`,
    },
    {
      id: 'discipline', titleKey: 'role_discipline', descKey: 'roleDesc_discipline',
      icon: Shield,
      from: '#f97316', to: '#ef4444', glow: 'rgba(249,115,22,0.30)',
      hoverBorder: 'hover:border-orange-500/50', activeBg: 'rgba(249,115,22,0.08)',
      path: `/login/discipline/${schoolId}`,
    },
    {
      id: 'vice_principal', titleKey: 'role_vp', descKey: 'roleDesc_vp',
      icon: UserCheck,
      from: '#a855f7', to: '#ec4899', glow: 'rgba(168,85,247,0.30)',
      hoverBorder: 'hover:border-purple-500/50', activeBg: 'rgba(168,85,247,0.08)',
      path: `/login/vice-principal/${schoolId}`,
    },
    {
      id: 'admin', titleKey: 'role_admin', descKey: 'roleDesc_admin',
      icon: Key,
      from: '#6366f1', to: '#8b5cf6', glow: 'rgba(99,102,241,0.30)',
      hoverBorder: 'hover:border-indigo-500/50', activeBg: 'rgba(99,102,241,0.08)',
      path: `/login/administrator/${schoolId}`,
    },
  ];

  return (
    <>
      <Helmet><title>{t('whoAreYou')} · CloudCampus</title></Helmet>

      <div className="min-h-screen bg-background font-sans overflow-hidden relative">
        {/* Atmospheric background */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-[700px] h-[700px] rounded-full bg-primary/6 blur-[140px]" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-purple-600/6 blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.016]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.15) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        </div>

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 pt-6 pb-2 relative z-10">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/30">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight">
              Cloud<span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">Campus</span>
            </span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </motion.div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">

          {/* Headline */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="text-center space-y-4">
            <button onClick={() => navigate(`/select-school`)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1 group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              {t('backToSchools')}
            </button>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">{t('whoAreYou')}</h1>
            <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">{t('selectYourRole')}</p>
          </motion.div>

          {/* Role cards */}
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <motion.div key={role.id} variants={cardVariant}>
                  <Link to={role.path} className="block h-full group">
                    <div
                      className={`relative h-full flex flex-col items-center text-center gap-5 p-7 rounded-3xl border border-white/8 backdrop-blur-sm transition-all duration-300 cursor-pointer overflow-hidden ${role.hoverBorder} hover:-translate-y-2`}
                      style={{ background: 'rgba(255,255,255,0.02)' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.boxShadow = `0 20px 56px ${role.glow}`;
                        e.currentTarget.style.background = role.activeBg;
                        e.currentTarget.style.borderColor = role.from + '40';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.boxShadow = '';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                        e.currentTarget.style.borderColor = '';
                      }}
                    >
                      {/* Icon circle */}
                      <div className="relative z-10 p-5 rounded-3xl transition-all duration-300 group-hover:scale-110"
                        style={{ background: `${role.from}18`, border: `1px solid ${role.from}28` }}>
                        <Icon className="w-9 h-9" style={{ color: role.from }} />
                      </div>

                      {/* Title + desc */}
                      <div className="relative z-10 flex-1 space-y-2">
                        <h3 className="text-lg font-black tracking-tight">{t(role.titleKey)}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{t(role.descKey)}</p>
                      </div>

                      {/* Login CTA */}
                      <div className="relative z-10 mt-2 w-full flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-y-1 group-hover:translate-y-0">
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: role.from }}>Login</span>
                        <ArrowRight className="w-3.5 h-3.5" style={{ color: role.from }} />
                      </div>

                      {/* Top accent line */}
                      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-3xl"
                        style={{ background: `linear-gradient(90deg, ${role.from}, ${role.to})` }} />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Footer */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="text-center text-[11px] text-muted-foreground/40">
            CloudCampus by Axion Enterprise · Secure authentication
          </motion.p>
        </div>
      </div>
    </>
  );
};

export default RoleSelectionPage;
