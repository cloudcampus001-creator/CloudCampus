import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, GraduationCap, Shield, Key, ArrowLeft,
  Cloud, UserCheck, ArrowRight, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';

/* ── Role definitions — single source of truth for colours ────────────
   Matches exactly:
     Admin       → indigo/violet  (AdminDashboard)
     VP          → purple/pink    (VicePrincipalDashboard)
     Discipline  → orange/red     (DisciplineDashboard)
     Teacher     → emerald/teal   (TeacherDashboard)
     Parent      → blue/cyan      (ParentDashboard)
──────────────────────────────────────────────────────────────────── */
const roles = (schoolId) => [
  {
    id: 'parent',
    title: 'Parent',
    icon: User,
    emoji: '👨‍👩‍👧',
    description: 'Monitor your childs progress, marks & attendance',
    color:    'text-blue-400',
    bg:       'bg-blue-500/10',
    border:   'hover:border-blue-500/40',
    gradient: 'from-blue-500 to-cyan-400',
    glow:     'hover:shadow-blue-500/20',
    activeBg: 'bg-blue-500/5',
    path: `/login/parent/${schoolId}`,
  },
  {
    id: 'teacher',
    title: 'Teacher',
    icon: GraduationCap,
    emoji: '📖',
    description: 'Manage classes, log lessons, enter marks & publish resources',
    color:    'text-emerald-400',
    bg:       'bg-emerald-500/10',
    border:   'hover:border-emerald-500/40',
    gradient: 'from-emerald-500 to-teal-400',
    glow:     'hover:shadow-emerald-500/20',
    activeBg: 'bg-emerald-500/5',
    path: `/login/teacher/${schoolId}`,
  },
  {
    id: 'discipline',
    title: 'Discipline Master',
    icon: Shield,
    emoji: '⚖️',
    description: 'Review registers, manage punishments & process justifications',
    color:    'text-orange-400',
    bg:       'bg-orange-500/10',
    border:   'hover:border-orange-500/40',
    gradient: 'from-orange-500 to-red-500',
    glow:     'hover:shadow-orange-500/20',
    activeBg: 'bg-orange-500/5',
    path: `/login/discipline/${schoolId}`,
  },
  {
    id: 'vice_principal',
    title: 'Vice Principal',
    icon: UserCheck,
    emoji: '📐',
    description: 'Oversee logbooks, review marksheets & manage class operations',
    color:    'text-purple-400',
    bg:       'bg-purple-500/10',
    border:   'hover:border-purple-500/40',
    gradient: 'from-purple-500 to-pink-500',
    glow:     'hover:shadow-purple-500/20',
    activeBg: 'bg-purple-500/5',
    path: `/login/vice-principal/${schoolId}`,
  },
  {
    id: 'admin',
    title: 'Administrator',
    icon: Key,
    emoji: '🛡️',
    description: 'Full school control — users, classes, timetables & analytics',
    color:    'text-indigo-400',
    bg:       'bg-indigo-500/10',
    border:   'hover:border-indigo-500/40',
    gradient: 'from-indigo-500 to-violet-500',
    glow:     'hover:shadow-indigo-500/20',
    activeBg: 'bg-indigo-500/5',
    path: `/login/administrator/${schoolId}`,
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const cardVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

const RoleSelectionPage = () => {
  const { schoolId } = useParams();
  const navigate     = useNavigate();
  const roleList     = roles(schoolId);

  return (
    <>
      <Helmet>
        <title>Select Role — CloudCampus</title>
      </Helmet>

      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">

        {/* ── Ambient background ───────────────────────────────────────── */}
        <div className="absolute inset-0 -z-10 bg-background">
          <div className="absolute top-1/4  left-1/4   w-[32rem] h-[32rem] bg-indigo-500/10  rounded-full blur-[140px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[32rem] h-[32rem] bg-purple-500/10  rounded-full blur-[140px]" />
          <div className="absolute top-3/4  left-2/3   w-[20rem] h-[20rem] bg-emerald-500/8  rounded-full blur-[120px]" />
        </div>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-10 space-y-4"
        >
          <Button
            variant="ghost"
            className="mb-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl"
            onClick={() => navigate('/select-school')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to School Selection
          </Button>

          {/* Logo pill */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2.5 bg-card/60 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-2.5 shadow-lg">
              <Cloud className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-base bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-400">
                CloudCampus
              </span>
              <span className="ml-1 flex items-center gap-1 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5" /> AI-powered
              </span>
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Who are you?
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
            Select your role to access your personalised dashboard and tools.
          </p>
        </motion.div>

        {/* ── Role cards ───────────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 px-2"
        >
          {roleList.map((role) => (
            <motion.div key={role.id} variants={cardVariants} className="h-full">
              <Link to={role.path} className="block h-full group">
                <div className={`
                  h-full relative flex flex-col items-center text-center gap-4 p-6 rounded-2xl
                  border border-white/8 bg-card/40 backdrop-blur-xl
                  transition-all duration-300 cursor-pointer overflow-hidden
                  ${role.border} ${role.glow}
                  hover:shadow-2xl hover:-translate-y-1.5 hover:${role.activeBg}
                  hover:border-opacity-60
                `}>

                  {/* Gradient background wash on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${role.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-300 rounded-2xl`} />

                  {/* Decorative corner accent */}
                  <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl ${role.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-bl-3xl rounded-tr-2xl`} />

                  {/* Icon */}
                  <div className={`
                    relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center
                    ${role.bg} ${role.color} ring-1 ring-white/10
                    group-hover:scale-110 group-hover:ring-2 transition-all duration-300
                    shadow-lg
                  `}>
                    <role.icon className="w-7 h-7" />
                    {/* Emoji badge */}
                    <span className="absolute -bottom-1.5 -right-1.5 text-base leading-none">
                      {role.emoji}
                    </span>
                  </div>

                  {/* Text */}
                  <div className="relative z-10 space-y-1.5 flex-1">
                    <h3 className="text-base font-bold leading-tight">{role.title}</h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                      {role.description}
                    </p>
                  </div>

                  {/* CTA */}
                  <div className={`relative z-10 mt-auto w-full pt-3 border-t border-white/5 flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-colors duration-200 ${role.color} opacity-60 group-hover:opacity-100`}>
                    Sign In
                    <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-xs text-muted-foreground/50 text-center"
        >
          Each role has a dedicated workspace. Contact your administrator if you're unsure which to choose.
        </motion.p>
      </div>
    </>
  );
};

export default RoleSelectionPage;
