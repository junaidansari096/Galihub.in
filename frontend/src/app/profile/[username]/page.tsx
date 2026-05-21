'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { User, Award, FileText, Eye, ThumbsUp, MapPin, Calendar, CheckCircle2, Clock, Ban } from 'lucide-react';

interface Slang {
  id: string;
  word: string;
  slug: string;
  meaning: string;
  originRegion: string;
  status: 'PENDING' | 'APPROVED' | 'HIDDEN' | 'REJECTED' | 'DELETED' | 'SHADOW_HIDDEN' | 'AI_FLAGGED';
  views: number;
  likes: number;
}

interface ProfileData {
  id: string;
  username: string;
  region: string;
  points: number;
  reputation: string;
  role: string;
  createdAt: string;
  stats: {
    totalUploads: number;
    totalViews: number;
    totalLikes: number;
  };
  gaalis: Slang[];
}

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const resolvedParams = use(params);
  const username = resolvedParams.username;
  const { user: currentUser } = useAuth();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getUserProfile(username);
      setProfile(res.profile);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span title="Approved & Public">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </span>
        );
      case 'PENDING':
      case 'AI_FLAGGED':
        return (
          <span title="Under Moderation Review">
            <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
          </span>
        );
      case 'REJECTED':
      case 'HIDDEN':
        return (
          <span title="Rejected / Hidden">
            <Ban className="h-4 w-4 text-red-500" />
          </span>
        );
      default:
        return null;
    }
  };

  const getLevelColor = (rep: string) => {
    switch (rep) {
      case 'Slang Master':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'Meme King':
        return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'Local Legend':
        return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  if (loading) return <div className="text-center py-16 text-slate-400 animate-pulse">Loading profile file...</div>;

  if (error || !profile) {
    return (
      <div className="max-w-md mx-auto py-12 text-center bg-[#1e293b] border border-[#334155] p-8 rounded-2xl">
        <p className="text-slate-400 text-lg mb-4">{error || 'Profile not found'}</p>
        <Link href="/" className="inline-block py-2 px-4 bg-[#ff4d4d] text-white font-bold rounded-xl transition-all shadow-md">
          Back to Discover
        </Link>
      </div>
    );
  }

  const isOwnProfile = currentUser && currentUser.id === profile.id;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. Header Profile details card */}
      <div className="p-8 rounded-2xl bg-[#1e293b] border border-[#334155] relative overflow-hidden shadow-xl">
        {/* Background glow decorator */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff4d4d]/10 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="h-24 w-24 rounded-2xl bg-[#ff4d4d] text-white flex items-center justify-center font-black text-4xl shadow-lg border border-[#ff4d4d]/30">
            {profile.username.slice(0, 2).toUpperCase()}
          </div>

          <div className="space-y-2 text-center md:text-left flex-1">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <h1 className="text-3xl font-extrabold text-white">{profile.username}</h1>
              <span className={`text-xs font-bold px-3 py-1 border rounded-full uppercase tracking-wider ${getLevelColor(profile.reputation)}`}>
                {profile.reputation}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-[#ff4d4d]" /> {profile.region}</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
              {profile.role !== 'USER' && (
                <span className="text-xs bg-[#ff4d4d]/20 text-[#ff4d4d] border border-[#ff4d4d]/30 font-bold px-2 py-0.5 rounded-md">
                  {profile.role}
                </span>
              )}
            </div>
          </div>

          {/* Reward Points stats card */}
          <div className="flex items-center gap-3 bg-[#0f172a] border border-[#334155] p-5 rounded-2xl">
            <Award className="h-10 w-10 text-amber-500" />
            <div>
              <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Contributor score</span>
              <span className="text-2xl font-black text-white">{profile.points} <span className="text-sm font-normal text-slate-400">pts</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Stats overview grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1e293b] border border-[#334155] p-6 rounded-2xl flex items-center gap-4 shadow-md">
          <div className="p-3 bg-[#ff4d4d]/10 rounded-xl text-[#ff4d4d]">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-450 block font-bold uppercase tracking-wider">Uploaded slangs</span>
            <span className="text-2xl font-black text-white">{profile.stats.totalUploads}</span>
          </div>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] p-6 rounded-2xl flex items-center gap-4 shadow-md">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
            <Eye className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-455 block font-bold uppercase tracking-wider">Total definition views</span>
            <span className="text-2xl font-black text-white">{profile.stats.totalViews}</span>
          </div>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] p-6 rounded-2xl flex items-center gap-4 shadow-md">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <ThumbsUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-455 block font-bold uppercase tracking-wider">Likes Received</span>
            <span className="text-2xl font-black text-white">{profile.stats.totalLikes}</span>
          </div>
        </div>
      </div>

      {/* 3. Submissions checklist */}
      <div className="space-y-4">
        <h2 className="text-2xl font-black text-white">Slang Submissions Feed</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.gaalis.map((g) => (
            <div key={g.id} className="p-6 rounded-2xl bg-[#1e293b] border border-[#334155] space-y-3 relative hover-scale">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-800 text-slate-350 rounded-md">
                  {g.originRegion}
                </span>
                
                <div className="flex items-center gap-3">
                  {isOwnProfile && getStatusIcon(g.status)}
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Eye className="h-3 w-3" /> {g.views}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {g.likes}</span>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {g.status === 'APPROVED' ? (
                    <Link href={`/slang/${g.slug}`} className="hover:text-[#ff4d4d] transition-colors">{g.word}</Link>
                  ) : (
                    <span>{g.word}</span>
                  )}
                </h3>
                <p className="text-slate-350 text-sm line-clamp-2">{g.meaning}</p>
              </div>

              {isOwnProfile && g.status !== 'APPROVED' && (
                <div className="pt-2 border-t border-[#334155] flex items-center gap-1.5 text-xs text-amber-500">
                  <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-ping" />
                  <span>Pending human moderator approval (AI Score: {g.likes === 0 ? 'Queued' : 'Evaluating'})</span>
                </div>
              )}
            </div>
          ))}

          {profile.gaalis.length === 0 && (
            <div className="col-span-2 text-center py-12 border border-dashed border-[#334155] rounded-2xl text-slate-500">
              No slangs submitted yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
