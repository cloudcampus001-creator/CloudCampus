/**
 * ProfileSheet.jsx
 * ─────────────────────────────────────────────────────────────
 * iOS-style glassmorphism bottom sheet that slides up when the
 * user taps/clicks their profile avatar in any dashboard sidebar.
 *
 * Usage:
 *   <ProfileSheet
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     userName="John Doe"
 *     role="Teacher"            ← display string
 *     accentFrom="from-emerald-500"
 *     accentTo="to-teal-400"
 *     onSignOut={handleSignOut}
 *   />
 *
 * For Parent role pass extra props:
 *   studentName="Alice Doe"
 *   studentClass="Form 5 Science A"
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Bot, Info, Mail, X, GraduationCap, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ── tiny helper ─────────────────────────────────────────── */
const getInitials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

/* ── quick-link row ──────────────────────────────────────── */
const QuickLink = ({ icon: Icon, label, onClick, accent = false }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-left
      ${accent
        ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 hover:from-indigo-500/30 hover:to-purple-500/30'
        : 'hover:bg-white/8 text-foreground/80 hover:text-foreground border border-transparent hover:border-white/10'
      }`}
  >
    <span className={`p-2 rounded-xl ${accent ? 'bg-indigo-500/20' : 'bg-white/8'}`}>
      <Icon className="h-4 w-4" />
    </span>
    <span className="text-sm font-medium">{label}</span>
  </button>
);

/* ── main component ──────────────────────────────────────── */
const ProfileSheet = ({
  open,
  onClose,
  userName = '',
  role = '',
  roleLabel = '',           // e.g. "Administrator", "Teacher"
  accentFrom = 'from-indigo-500',
  accentTo = 'to-violet-500',
  onSignOut,
  /* parent-only */
  isParent = false,
  studentName = '',
  studentClass = '',
}) => {
  const navigate = useNavigate();

  const go = (path) => { onClose(); navigate(path); };
  const signOut = () => { onClose(); onSignOut?.(); };

  const displayName  = isParent ? studentName : userName;
  const displayRole  = roleLabel || role;
  const subtitle     = isParent && studentClass ? studentClass : displayRole;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ───────────────────────────────────────── */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
          />

          {/* ── Sheet ──────────────────────────────────────────── */}
          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] px-3 pb-6"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto max-w-md w-full">
              {/* ── Glass card ─────────────────────────────────── */}
              <div className="bg-card/70 backdrop-blur-3xl border border-white/15 rounded-3xl shadow-[0_-8px_60px_rgba(0,0,0,0.5)] overflow-hidden">

                {/* drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/8 hover:bg-white/15 transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>

                {/* ── Profile hero ─────────────────────────────── */}
                <div className="flex flex-col items-center pt-3 pb-6 px-6">
                  {/* Avatar */}
                  <div className="relative mb-4">
                    <div className={`h-20 w-20 rounded-3xl bg-gradient-to-br ${accentFrom} ${accentTo} flex items-center justify-center shadow-2xl`}>
                      <span className="text-white text-2xl font-bold tracking-tight">
                        {getInitials(displayName)}
                      </span>
                    </div>
                    {/* online dot */}
                    <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-card shadow" />
                  </div>

                  {/* Name */}
                  <h2 className="text-lg font-bold tracking-tight text-foreground">
                    {displayName || 'Unknown'}
                  </h2>

                  {/* Role / Class badge */}
                  <div className={`mt-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${accentFrom} ${accentTo} text-white shadow`}>
                    {subtitle}
                  </div>

                  {/* Parent extra: also show parent name */}
                  {isParent && userName && (
                    <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Parent: {userName}
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-white/8 mx-4" />

                {/* ── Quick links ─────────────────────────────── */}
                <div className="px-3 py-3 space-y-1">
                  <QuickLink
                    icon={Bot}
                    label="Cloud AI Assistant"
                    onClick={() => go('/cloud-ai')}
                    accent
                  />
                  <QuickLink
                    icon={Info}
                    label="About CloudCampus"
                    onClick={() => go('/about')}
                  />
                  <QuickLink
                    icon={Mail}
                    label="Contact Us"
                    onClick={() => go('/contact')}
                  />
                </div>

                {/* Divider */}
                <div className="h-px bg-white/8 mx-4" />

                {/* ── Sign out ────────────────────────────────── */}
                <div className="px-3 pt-3 pb-4">
                  <button
                    onClick={signOut}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold transition-all text-sm"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileSheet;
