'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Search, MapPin, Eye, ThumbsUp, Calendar, Trophy, Sparkles, RefreshCw, Bookmark, Share2 } from 'lucide-react';

const REGIONS = [
  'All', 'Delhi', 'Uttar Pradesh', 'Bihar', 'West Bengal', 'Maharashtra', 
  'Punjab', 'Northeast', 'Rajasthan', 'Gujarat', 'South India'
];

interface Gaali {
  id: string;
  word: string;
  slug: string;
  meaning: string;
  originRegion: string;
  language: string;
  likes: number;
  views: number;
  uploader?: {
    username: string;
    role: string;
    reputation: string;
  };
}

interface LeaderboardUser {
  id: string;
  username: string;
  points: number;
  reputation: string;
  region: string;
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [searchResults, setSearchResults] = useState<Gaali[]>([]);
  const [randomGaali, setRandomGaali] = useState<Gaali | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [trending, setTrending] = useState<Gaali[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch initial trending data and leaderboard
  useEffect(() => {
    fetchTrendingAndLeaderboard();
    fetchRandomGaali();
  }, []);

  // Fetch results when search text or region filter changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, selectedRegion]);

  const fetchTrendingAndLeaderboard = async () => {
    try {
      // Fetch trending (search empty parameters)
      const res = await api.search();
      setTrending(res.gaalis.slice(0, 6)); // Top 6 trending
      
      // Fetch leaderboard
      const lbRes = await api.getLeaderboard();
      setLeaderboard(lbRes.leaderboard);
    } catch (err) {
      console.error('Failed to load initial stats', err);
    }
  };

  const handleSearch = async () => {
    setLoadingSearch(true);
    try {
      const params: any = {};
      if (searchQuery.trim() !== '') params.q = searchQuery;
      if (selectedRegion !== 'All') params.region = selectedRegion;

      const res = await api.search(params);
      setSearchResults(res.gaalis);
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const fetchRandomGaali = async () => {
    setLoadingRandom(true);
    try {
      const res = await api.getRandom();
      setRandomGaali(res.gaali);
    } catch (err) {
      console.error('Failed to fetch random slang', err);
    } finally {
      setLoadingRandom(false);
    }
  };

  const shareRandomGaali = () => {
    if (!randomGaali) return;
    const text = `Learn the meaning of "${randomGaali.word}" (${randomGaali.originRegion} slang): ${randomGaali.meaning}\nDiscover more on GaaliHub!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine what list to display
  const hasActiveSearch = searchQuery.trim() !== '' || selectedRegion !== 'All';
  const displayList = hasActiveSearch ? searchResults : trending;

  return (
    <div className="space-y-12">
      {/* 1. Hero Search Section */}
      <section className="text-center max-w-3xl mx-auto py-8 space-y-6">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Indian Slang & <span className="text-[#ff4d4d]">Linguistic Archive</span>
        </h1>
        <p className="text-slate-400 text-base max-w-xl mx-auto">
          Explore the definitions, contexts, and regional origins of colloquial Indian expressions, slangs, and terms.
        </p>

        {/* Large search input */}
        <div className="relative max-w-2xl mx-auto mt-6">
          <Search className="absolute left-4 top-3.5 h-6 w-6 text-slate-400" />
          <input
            type="text"
            placeholder="Search slang, phrase, or region... (e.g. bawa, chutiya)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-[#1e293b] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-2 focus:ring-[#ff4d4d]/30 transition-all text-base shadow-xl"
          />
        </div>
      </section>

      {/* 2. Interactive Region Explorer */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white tracking-wide uppercase flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#ff4d4d]" /> Region Explorer
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                selectedRegion === region
                  ? 'bg-[#ff4d4d] text-white border-[#ff4d4d] shadow-lg shadow-[#ff4d4d]/20 scale-105'
                  : 'bg-[#1e293b] text-slate-300 border-[#334155] hover:border-slate-500 hover:text-white'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </section>

      {/* 3. Random Slang & Main Discovery Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Feed (Search results or Trending card grid) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-[#334155] pb-3">
            <h3 className="text-2xl font-extrabold text-white">
              {hasActiveSearch ? `Search Results (${searchResults.length})` : '🔥 Popular Trending Slangs'}
            </h3>
            {loadingSearch && <span className="text-xs text-slate-400 animate-pulse">Searching catalog...</span>}
          </div>

          {displayList.length === 0 ? (
            <div className="text-center py-12 bg-[#1e293b]/30 border border-dashed border-[#334155] rounded-2xl">
              <p className="text-slate-400 text-lg font-medium">No slangs found matching your query.</p>
              <button 
                onClick={() => { setSearchQuery(''); setSelectedRegion('All'); }}
                className="mt-3 text-sm font-semibold text-[#ff4d4d] hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayList.map((g) => (
                <Link key={g.id} href={`/slang/${g.slug}`} className="group block p-6 rounded-2xl bg-[#1e293b] border border-[#334155] hover:border-slate-400 transition-all hover-scale">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded-md">
                      {g.originRegion}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {g.views}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {g.likes}</span>
                    </div>
                  </div>
                  <h4 className="text-xl font-bold text-white group-hover:text-[#ff4d4d] transition-colors mb-2">
                    {g.word}
                  </h4>
                  <p className="text-slate-350 text-sm line-clamp-2">
                    {g.meaning}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-[#334155] pt-3">
                    <span>Uploaded by: <strong className="text-slate-200">{g.uploader?.username || 'Anonymous'}</strong></span>
                    <span className="px-1.5 py-0.5 bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/20 rounded-md text-[10px]">
                      {g.uploader?.reputation || 'Beginner'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar panels */}
        <div className="space-y-8">
          
          {/* Daily Random Card */}
          {randomGaali && (
            <div className="p-6 rounded-2xl glass-card border border-[#334155] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Random Slang
                </span>
                <button 
                  onClick={fetchRandomGaali} 
                  disabled={loadingRandom}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50"
                  title="Next random slang"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingRandom ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div>
                <h4 className="text-2xl font-extrabold text-white mb-1">{randomGaali.word}</h4>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md">
                  {randomGaali.originRegion} ({randomGaali.language})
                </span>
              </div>

              <p className="text-slate-300 text-sm leading-relaxed border-t border-[#334155] pt-3">
                {randomGaali.meaning}
              </p>

              <div className="flex gap-2 pt-2 border-t border-[#334155]">
                <button
                  onClick={shareRandomGaali}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
                >
                  <Share2 className="h-4 w-4" /> {copied ? 'Copied!' : 'Share'}
                </button>
                <Link
                  href={`/slang/${randomGaali.slug}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#ff4d4d] hover:bg-[#e04343] text-xs font-semibold text-white transition-all text-center"
                >
                  Read Usage
                </Link>
              </div>
            </div>
          )}

          {/* Contributor Leaderboard */}
          <div id="leaderboard" className="p-6 rounded-2xl bg-[#1e293b] border border-[#334155] space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Top Slang Catalogers
            </h3>
            
            <div className="divide-y divide-[#334155]">
              {leaderboard.map((user, idx) => (
                <div key={user.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-5 text-center text-sm font-bold ${
                      idx === 0 ? 'text-amber-500 text-lg' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-slate-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <Link href={`/profile/${user.username}`} className="text-sm font-semibold text-white hover:underline">
                        {user.username}
                      </Link>
                      <p className="text-[10px] text-slate-400">
                        {user.region} • {user.reputation}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-500">
                    {user.points} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
