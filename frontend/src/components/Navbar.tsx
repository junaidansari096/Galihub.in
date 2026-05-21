'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { ShieldAlert, BookOpen, Trophy, PlusCircle, LogIn, UserPlus, LogOut, LayoutDashboard, User } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#334155] bg-[#0f172a]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff4d4d] text-white font-bold text-lg hover-scale">
              G
            </div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#ff4d4d] transition-colors">
              Gaali<span className="text-[#ff4d4d]">Hub</span>
            </span>
          </Link>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <Link href="/" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <BookOpen className="h-4 w-4" /> Discover
          </Link>
          <Link href="/upload" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <PlusCircle className="h-4 w-4 text-[#f59e0b]" /> Upload Slang
          </Link>
          <Link href="/#leaderboard" className="flex items-center gap-1.5 hover:text-white transition-colors">
            <Trophy className="h-4 w-4" /> Leaderboard
          </Link>
        </nav>

        {/* User Actions */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              {/* User Points Badge */}
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs text-slate-400">Reputation</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30 rounded-full">
                  {user.reputation} ({user.points} pts)
                </span>
              </div>

              {/* Admin Portal Dashboard Quick Link */}
              {['ADMIN', 'SUPERADMIN', 'MODERATOR'].includes(user.role) && (
                <Link
                  href="/admin"
                  className="p-2 rounded-lg bg-[#334155] text-slate-200 hover:text-white hover:bg-slate-700 transition-all"
                  title="Admin Dashboard"
                >
                  <LayoutDashboard className="h-5 w-5" />
                </Link>
              )}

              {/* Profile */}
              <Link
                href={`/profile/${user.username}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#334155] hover:border-slate-400 bg-[#1e293b] text-sm text-slate-200 hover:text-white transition-all"
              >
                <User className="h-4 w-4 text-[#ff4d4d]" />
                <span className="font-medium max-w-[80px] truncate">{user.username}</span>
              </Link>

              {/* Logout */}
              <button
                onClick={logout}
                className="p-2 rounded-lg text-slate-400 hover:text-[#ff4d4d] hover:bg-red-500/10 transition-all"
                title="Log Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm text-slate-200 hover:text-white hover:bg-slate-800 transition-all"
              >
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#ff4d4d] hover:bg-[#e04343] text-sm font-semibold text-white transition-all shadow-md"
              >
                <UserPlus className="h-4 w-4" /> Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
