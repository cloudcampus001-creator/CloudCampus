/**
 * Skeletons.jsx
 * iOS-style shimmer skeleton components.
 * Import what you need per page.
 */
import React from 'react';
import { cn } from '@/lib/utils';

/* ── Base shimmer block ─────────────────────────────── */
export const Shimmer = ({ className }) => (
  <div className={cn(
    'animate-pulse rounded-xl bg-white/8 dark:bg-white/6',
    className
  )} />
);

/* ── Stat card skeleton ─────────────────────────────── */
export const StatCardSkeleton = () => (
  <div className="glass rounded-2xl p-5 space-y-3">
    <div className="flex items-center justify-between">
      <Shimmer className="h-4 w-28" />
      <Shimmer className="h-8 w-8 rounded-xl" />
    </div>
    <Shimmer className="h-8 w-16" />
    <Shimmer className="h-3 w-24" />
  </div>
);

/* ── Notification item skeleton ─────────────────────── */
export const NotifSkeleton = () => (
  <div className="glass rounded-2xl p-4 flex gap-4">
    <Shimmer className="h-10 w-10 rounded-2xl shrink-0" />
    <div className="flex-1 space-y-2">
      <Shimmer className="h-4 w-3/4" />
      <Shimmer className="h-3 w-full" />
      <Shimmer className="h-3 w-1/2" />
    </div>
  </div>
);

/* ── Book card skeleton ──────────────────────────────── */
export const BookSkeleton = () => (
  <div className="glass rounded-2xl overflow-hidden">
    <Shimmer className="h-44 w-full rounded-none" />
    <div className="p-5 space-y-3">
      <Shimmer className="h-5 w-3/4" />
      <Shimmer className="h-3 w-1/2" />
      <Shimmer className="h-10 w-full rounded-xl" />
    </div>
  </div>
);

/* ── Doc card skeleton ───────────────────────────────── */
export const DocSkeleton = () => (
  <div className="glass rounded-2xl p-4 flex gap-4">
    <Shimmer className="h-12 w-12 rounded-xl shrink-0" />
    <div className="flex-1 space-y-2 py-1">
      <Shimmer className="h-4 w-2/3" />
      <Shimmer className="h-3 w-1/2" />
      <Shimmer className="h-3 w-1/3" />
    </div>
  </div>
);

/* ── Punishment row skeleton ─────────────────────────── */
export const PunishSkeleton = () => (
  <div className="glass rounded-xl p-4 space-y-2">
    <div className="flex justify-between">
      <Shimmer className="h-4 w-1/2" />
      <Shimmer className="h-3 w-20" />
    </div>
    <Shimmer className="h-3 w-3/4" />
    <Shimmer className="h-3 w-1/3" />
  </div>
);

/* ── Chart area skeleton ─────────────────────────────── */
export const ChartSkeleton = () => (
  <div className="glass rounded-2xl p-5 space-y-4">
    <div className="flex justify-between items-center">
      <Shimmer className="h-5 w-32" />
      <Shimmer className="h-6 w-20 rounded-full" />
    </div>
    <div className="flex items-end gap-2 h-32 pt-4">
      {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
        <Shimmer key={i} className="flex-1 rounded-lg" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);
