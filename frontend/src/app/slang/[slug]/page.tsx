'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { ArrowLeft, MapPin, Eye, ThumbsUp, ThumbsDown, MessageSquare, Check, Send, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    username: string;
    role: string;
    reputation: string;
  };
}

interface Gaali {
  id: string;
  word: string;
  slug: string;
  meaning: string;
  emotionalMeaning: string;
  exampleSentence: string;
  originRegion: string;
  language: string;
  severity: 'MILD' | 'MEDIUM' | 'EXTREME';
  views: number;
  likes: number;
  dislikes: number;
  uploaderId?: string;
  uploader?: {
    username: string;
    role: string;
    reputation: string;
  };
  tags: Tag[];
  comments: Comment[];
  synonyms?: string[];
  isVerified?: boolean;
  isNsfw?: boolean;
  isFeatured?: boolean;
}

export default function SlangDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const { user } = useAuth();
  
  const [word, setWord] = useState<string>('');
  const [definitions, setDefinitions] = useState<Gaali[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-definition interactive states mapped by entry ID
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [dislikedMap, setDislikedMap] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const [commentErrors, setCommentErrors] = useState<Record<string, string | null>>({});
  const [flagSuccessMap, setFlagSuccessMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    fetchSlangDetails();
  }, [slug]);

  const fetchSlangDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDetail(slug);
      setWord(res.word || res.gaali.word);
      setDefinitions(res.definitions || [res.gaali]);
    } catch (err: any) {
      setError(err.message || 'Failed to load slang details.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (id: string) => {
    if (!user) {
      setError('You must sign in to upvote slangs.');
      return;
    }
    try {
      const res = await api.like(id);
      setDefinitions(prev =>
        prev.map(d => (d.id === id ? { ...d, likes: res.likes, dislikes: res.dislikes } : d))
      );
      setLikedMap(prev => ({ ...prev, [id]: res.userLiked }));
      setDislikedMap(prev => ({ ...prev, [id]: false }));
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDislike = async (id: string) => {
    if (!user) {
      setError('You must sign in to downvote slangs.');
      return;
    }
    try {
      const res = await api.dislike(id);
      setDefinitions(prev =>
        prev.map(d => (d.id === id ? { ...d, likes: res.likes, dislikes: res.dislikes } : d))
      );
      setDislikedMap(prev => ({ ...prev, [id]: res.userDisliked }));
      setLikedMap(prev => ({ ...prev, [id]: false }));
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent, entryId: string) => {
    e.preventDefault();
    if (!user) {
      setCommentErrors(prev => ({ ...prev, [entryId]: 'You must sign in to add comments.' }));
      return;
    }
    const commentText = commentTexts[entryId] || '';
    if (commentText.trim() === '') return;

    setSubmittingCommentId(entryId);
    setCommentErrors(prev => ({ ...prev, [entryId]: null }));

    try {
      const res = await api.comment(entryId, commentText);
      
      setDefinitions(prev =>
        prev.map(d =>
          d.id === entryId
            ? { ...d, comments: [res.comment, ...d.comments] }
            : d
        )
      );
      setCommentTexts(prev => ({ ...prev, [entryId]: '' }));
    } catch (err: any) {
      setCommentErrors(prev => ({ ...prev, [entryId]: err.message || 'Failed to post comment.' }));
    } finally {
      setSubmittingCommentId(null);
    }
  };

  const handleFlagToggle = async (entryId: string, field: 'isVerified' | 'isNsfw' | 'isFeatured', value: boolean) => {
    try {
      await api.updateSlangFlags(entryId, { [field]: value });
      setDefinitions(prev =>
        prev.map(d => (d.id === entryId ? { ...d, [field]: value } : d))
      );
      const label = field === 'isVerified' ? 'Verification' : field === 'isNsfw' ? 'NSFW status' : 'Featured status';
      setFlagSuccessMap(prev => ({ ...prev, [entryId]: `${label} updated successfully.` }));
      setTimeout(() => setFlagSuccessMap(prev => ({ ...prev, [entryId]: null })), 3000);
    } catch (err: any) {
      console.error(err);
    }
  };

  const toggleCommentsSection = (entryId: string) => {
    setOpenComments(prev => ({ ...prev, [entryId]: !prev[entryId] }));
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'MILD':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'EXTREME':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-700';
    }
  };

  if (loading) return <div className="text-center py-16 text-slate-400 animate-pulse text-lg">Loading definition catalog...</div>;

  if (error || definitions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="bg-red-500/15 border border-red-500/30 text-red-500 p-4 rounded-xl text-sm flex items-center justify-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span>{error || 'Slang not found'}</span>
        </div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#ff4d4d] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Return to Discover Page
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Back button */}
      <div>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Discover
        </Link>
      </div>

      {/* Dictionary Word Title */}
      <div className="space-y-2 border-b border-[#334155] pb-6">
        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight capitalize">{word}</h1>
        <p className="text-slate-400 text-sm">
          Displaying {definitions.length} definition{definitions.length > 1 ? 's' : ''} for this slang.
        </p>
      </div>

      {/* Definitions List */}
      <div className="space-y-12">
        {definitions.map((gaali, index) => (
          <div key={gaali.id} className="p-8 rounded-2xl bg-[#1e293b] border border-[#334155] space-y-6 shadow-xl relative animate-fadeIn">
            
            {/* Definition Header Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#334155] pb-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 bg-[#ff4d4d]/10 text-[#ff4d4d] rounded-md border border-[#ff4d4d]/20">
                    Definition #{index + 1}
                  </span>
                  {gaali.isVerified && (
                    <span className="flex items-center gap-0.5 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 font-semibold">
                      <Check className="h-3 w-3" /> Verified
                    </span>
                  )}
                  {gaali.isNsfw && (
                    <span className="flex items-center gap-1 text-xs text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 font-bold">
                      NSFW
                    </span>
                  )}
                  {gaali.isFeatured && (
                    <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-semibold">
                      ★ Featured
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 items-center pt-1">
                  <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                    <MapPin className="h-3.5 w-3.5 text-[#ff4d4d]" /> {gaali.originRegion}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                    Language: {gaali.language}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 border rounded-lg ${getSeverityBadgeColor(gaali.severity)}`}>
                    {gaali.severity} Severity
                  </span>
                </div>
              </div>

              {/* Stats and Rating buttons */}
              <div className="flex items-center gap-4 self-start md:self-auto">
                <span className="text-sm text-slate-400 flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-xl">
                  <Eye className="h-4 w-4" /> {gaali.views} Views
                </span>
                <div className="flex items-center border border-[#334155] rounded-xl overflow-hidden bg-[#0f172a]">
                  <button
                    onClick={() => handleLike(gaali.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer ${
                      likedMap[gaali.id] ? 'bg-[#ff4d4d] text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4" /> {gaali.likes}
                  </button>
                  <div className="w-[1px] h-6 bg-[#334155]" />
                  <button
                    onClick={() => handleDislike(gaali.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold transition-all cursor-pointer ${
                      dislikedMap[gaali.id] ? 'bg-amber-500 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <ThumbsDown className="h-4 w-4" /> {gaali.dislikes}
                  </button>
                </div>
              </div>
            </div>

            {/* Slang meanings sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold uppercase text-slate-400 tracking-wider">
                  Real Dictionary Meaning
                </h3>
                <p className="text-white text-base md:text-lg font-medium leading-relaxed bg-[#0f172a]/40 border border-[#334155]/40 p-4 rounded-xl">
                  {gaali.meaning}
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-extrabold uppercase text-slate-400 tracking-wider">
                  Linguistic Context & Usage vibe
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed bg-[#0f172a]/40 border border-[#334155]/40 p-4 rounded-xl">
                  {gaali.emotionalMeaning}
                </p>
              </div>
            </div>

            {/* Usage example sentence */}
            <div className="border-t border-[#334155] pt-6 space-y-3">
              <h3 className="text-sm font-extrabold uppercase text-slate-400 tracking-wider">
                Sentence Example
              </h3>
              <blockquote className="border-l-4 border-[#ff4d4d] pl-4 py-1.5 italic text-slate-200 text-base leading-relaxed bg-[#0f172a]/40 rounded-r-lg pr-4">
                &ldquo;{gaali.exampleSentence}&rdquo;
              </blockquote>
            </div>

            {/* Related Tags */}
            <div className="border-t border-[#334155] pt-6 space-y-3">
              <h3 className="text-sm font-extrabold uppercase text-slate-400 tracking-wider">
                Similar Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {gaali.tags.map((t) => (
                  <span key={t.id} className="text-xs px-2.5 py-1 bg-slate-800 text-slate-350 rounded-lg border border-[#334155]">
                    #{t.name}
                  </span>
                ))}
                {gaali.tags.length === 0 && <span className="text-xs text-slate-500">No tags added yet</span>}
              </div>
            </div>

            {/* AI Synonyms / Similar Slang */}
            {gaali.synonyms && gaali.synonyms.length > 0 && (
              <div className="border-t border-[#334155] pt-6 space-y-3">
                <h3 className="text-sm font-extrabold uppercase text-slate-400 tracking-wider">
                  AI Synonyms & Similar Slang
                </h3>
                <div className="flex flex-wrap gap-2">
                  {gaali.synonyms.map((s, idx) => (
                    <span key={idx} className="text-xs px-3 py-1 bg-[#ff4d4d]/10 text-white rounded-lg border border-[#ff4d4d]/20 font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Uploader Details */}
            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-[#334155] pt-5">
              <span>
                Uploaded by:{' '}
                <Link href={`/profile/${gaali.uploader?.username}`} className="font-semibold text-slate-200 hover:underline">
                  {gaali.uploader?.username || 'Anonymous'}
                </Link>
              </span>
              <span className="px-2 py-0.5 bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/20 rounded-md">
                {gaali.uploader?.reputation || 'Beginner'}
              </span>
            </div>

            {/* Moderator Controls Panel */}
            {user && (['ADMIN', 'SUPERADMIN'].includes(user.role) || gaali.uploaderId === user.id) && (
              <div className="mt-6 p-6 rounded-2xl bg-[#0f172a] border border-[#ff4d4d]/30 space-y-4">
                <h3 className="text-sm font-extrabold uppercase text-[#ff4d4d] tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5" /> Content Flag Administration
                </h3>
                <div className="flex flex-wrap gap-6 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={gaali.isVerified || false}
                      onChange={(e) => handleFlagToggle(gaali.id, 'isVerified', e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-[#334155] bg-[#1e293b] text-[#ff4d4d] focus:ring-[#ff4d4d]"
                    />
                    <span className="font-semibold text-slate-200">Verified Entry</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={gaali.isNsfw || false}
                      onChange={(e) => handleFlagToggle(gaali.id, 'isNsfw', e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-[#334155] bg-[#1e293b] text-[#ff4d4d] focus:ring-[#ff4d4d]"
                    />
                    <span className="font-semibold text-slate-200">Mark NSFW</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={gaali.isFeatured || false}
                      onChange={(e) => handleFlagToggle(gaali.id, 'isFeatured', e.target.checked)}
                      className="h-4.5 w-4.5 rounded border-[#334155] bg-[#1e293b] text-[#ff4d4d] focus:ring-[#ff4d4d]"
                    />
                    <span className="font-semibold text-slate-200">Feature on Homepage</span>
                  </label>
                </div>
                {flagSuccessMap[gaali.id] && <p className="text-xs text-emerald-400">{flagSuccessMap[gaali.id]}</p>}
              </div>
            )}

            {/* Comments Thread Toggle */}
            <div className="border-t border-[#334155] pt-5">
              <button
                onClick={() => toggleCommentsSection(gaali.id)}
                className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer border-0 bg-transparent p-0"
              >
                <MessageSquare className="h-4.5 w-4.5 text-[#ff4d4d]" />
                {openComments[gaali.id] ? 'Hide Discussion' : `Show Discussion (${gaali.comments.length})`}
              </button>
            </div>

            {/* Inline Comments Section */}
            {openComments[gaali.id] && (
              <div className="mt-4 pt-4 border-t border-[#334155]/50 space-y-6">
                <h4 className="text-md font-bold text-white">Discussion Thread</h4>

                {/* Add comment form */}
                <form onSubmit={(e) => handleAddComment(e, gaali.id)} className="flex gap-3">
                  <input
                    type="text"
                    placeholder={user ? "Add to the discussion..." : "Sign in to join the discussion..."}
                    disabled={!user || submittingCommentId === gaali.id}
                    value={commentTexts[gaali.id] || ''}
                    onChange={(e) => setCommentTexts(prev => ({ ...prev, [gaali.id]: e.target.value }))}
                    className="flex-1 px-4 py-3 rounded-xl bg-[#1e293b] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all disabled:opacity-50 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!user || submittingCommentId === gaali.id || (commentTexts[gaali.id] || '').trim() === ''}
                    className="bg-[#ff4d4d] hover:bg-[#e04343] disabled:bg-slate-700 disabled:text-slate-400 disabled:pointer-events-none p-3 rounded-xl text-white transition-all shadow-md cursor-pointer shrink-0"
                    title="Post Comment"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                {commentErrors[gaali.id] && <p className="text-xs text-red-500 pl-1">{commentErrors[gaali.id]}</p>}

                {/* List of comments */}
                <div className="space-y-4">
                  {gaali.comments.map((comment) => (
                    <div key={comment.id} className="p-4 rounded-2xl bg-[#0f172a]/60 border border-[#334155]/60 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Link href={`/profile/${comment.user.username}`} className="font-bold text-white hover:underline">
                            {comment.user.username}
                          </Link>
                          <span className="px-1.5 py-0.2 bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/20 rounded-md text-[9px]">
                            {comment.user.reputation}
                          </span>
                        </div>
                        <span className="text-slate-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">{comment.content}</p>
                    </div>
                  ))}
                  {gaali.comments.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-[#334155]/60 rounded-2xl">
                      No comments yet. Start the conversation!
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}
