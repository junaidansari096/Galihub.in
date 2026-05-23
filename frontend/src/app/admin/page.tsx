'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { ShieldCheck, Users, FileText, Activity, Check, X, Ban, ShieldAlert, Key, Clock, RotateCcw } from 'lucide-react';

interface QueueItem {
  id: string;
  word: string;
  meaning: string;
  emotionalMeaning: string;
  exampleSentence: string;
  originRegion: string;
  severity: string;
  aiToxicityScore: number;
  createdAt: string;
  uploader?: {
    username: string;
    role: string;
  };
}

interface AuditLog {
  id: string;
  actionType: string;
  targetUser: string | null;
  targetPost: string | null;
  reason: string;
  createdAt: string;
  admin: {
    username: string;
    role: string;
  };
}

interface SystemStats {
  totalUsers: number;
  totalSlangs: number;
  pendingReviews: number;
  popularSlangs: { word: string; views: number }[];
}

interface UploadLog {
  id: string;
  createdAt: string;
  fileName: string;
  uploaderUsername: string;
  uploaderRole: string;
  uploadType: 'SYSTEM' | 'USER';
  uploadedCount: number;
  repeatedCount: number;
  summary: string;
  isReverted: boolean;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'queue' | 'users' | 'logs' | 'import' | 'uploads'>('queue');
  
  // Data states
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  
  // User ban form states
  const [targetUsername, setTargetUsername] = useState('');
  const [banType, setBanType] = useState<'PERMANENT_BAN' | 'SHADOW_BAN' | 'TEMPORARY_SUSPEND' | 'UNBAN'>('TEMPORARY_SUSPEND');
  const [banReason, setBanReason] = useState('');
  const [suspendDays, setSuspendDays] = useState(3);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // CSV Import States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<{ uploadedCount: number; repeatedCount: number; totalProcessed: number } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  // Upload History States
  const [uploadLogs, setUploadLogs] = useState<UploadLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'SYSTEM' | 'USER'>('ALL');
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);

  // CSV Parser helpers
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];
    
    const headers = parseCSVLine(lines[0]);
    const results: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index] ? values[index].trim() : '';
      });
      results.push(row);
    }
    return results;
  };

  const parseCSVLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    
    return result.map(val => {
      let clean = val.trim();
      if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.slice(1, -1);
      }
      return clean.replace(/""/g, '"');
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setImportStats(null);
      setError(null);
      setSuccess(null);
    }
  };

  const handleImportSubmit = async () => {
    if (!selectedFile) return;
    const fileName = selectedFile.name;
    setImporting(true);
    setError(null);
    setSuccess(null);
    setImportErrors([]);
    
    try {
      const text = await selectedFile.text();
      const entries = parseCSV(text);
      if (entries.length === 0) {
        throw new Error('CSV file is empty or invalid.');
      }
      
      const res = await api.importCsv(entries, fileName);
      setImportStats({
        uploadedCount: res.uploadedCount,
        repeatedCount: res.repeatedCount,
        totalProcessed: res.totalProcessed
      });
      setSuccess(`Dataset import finished: ${res.uploadedCount} uploaded, ${res.repeatedCount} repeated/skipped.`);
      setSelectedFile(null);
      
      // Refresh stats
      const statsRes = await api.getStats();
      setStats(statsRes.stats);

      // Refresh upload logs
      if (user && ['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        const uploadsRes = await api.getUploadLogs();
        setUploadLogs(uploadsRes.logs);
      }
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        setImportErrors(err.details);
      }
      setError(err.message || 'Failed to process and upload CSV.');
    } finally {
      setImporting(false);
    }
  };

  // Redirect if unauthorized
  useEffect(() => {
    if (!user || !['MODERATOR', 'ADMIN', 'SUPERADMIN'].includes(user.role)) {
      router.push('/');
    } else {
      fetchAdminData();
    }
  }, [user, router]);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const statsRes = await api.getStats();
      setStats(statsRes.stats);

      const queueRes = await api.getQueue();
      setQueue(queueRes.queue);

      if (user && ['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        const logsRes = await api.getAuditLogs();
        setLogs(logsRes.logs);

        const uploadsRes = await api.getUploadLogs();
        setUploadLogs(uploadsRes.logs);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (gaaliId: string, action: 'APPROVE' | 'REJECT' | 'HIDE') => {
    setActionLoading(gaaliId);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.reviewUpload({ gaaliId, action, reason: `Manual moderator action: ${action}` });
      setSuccess(res.message);
      // Remove from local queue
      setQueue(queue.filter(item => item.id !== gaaliId));
      
      // Refresh statistics
      const statsRes = await api.getStats();
      setStats(statsRes.stats);
      
      if (user && ['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        const logsRes = await api.getAuditLogs();
        setLogs(logsRes.logs);
      }
    } catch (err: any) {
      setError(err.message || 'Moderation action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUserBan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!targetUsername.trim()) return;

    try {
      // First we need to find user ID by profile query
      const profileRes = await api.getUserProfile(targetUsername);
      const targetUserId = profileRes.profile.id;

      const res = await api.banUser({
        targetUserId,
        banType,
        reason: banReason || `Admin action: ${banType}`,
        durationDays: suspendDays
      });

      setSuccess(res.message);
      setTargetUsername('');
      setBanReason('');
      
      // Sync logs
      if (user && ['ADMIN', 'SUPERADMIN'].includes(user.role)) {
        const logsRes = await api.getAuditLogs();
        setLogs(logsRes.logs);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to penalize user. Verify username is correct.');
    }
  };

  const handleRollback = async (logId: string) => {
    const confirmRevert = window.confirm(
      "WARNING: Are you sure you want to rollback/revert this bulk CSV upload?\n\nThis will permanently delete all slang entries imported in this specific batch. This action cannot be undone."
    );
    if (!confirmRevert) return;

    setRollbackLoading(logId);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.rollbackUpload(logId);
      setSuccess(res.message || 'CSV upload successfully rolled back.');
      
      // Refresh statistics
      const statsRes = await api.getStats();
      setStats(statsRes.stats);
      
      // Refresh upload logs
      const uploadsRes = await api.getUploadLogs();
      setUploadLogs(uploadsRes.logs);

      // Refresh moderation queue
      const queueRes = await api.getQueue();
      setQueue(queueRes.queue);
    } catch (err: any) {
      setError(err.message || 'Failed to rollback CSV upload.');
    } finally {
      setRollbackLoading(null);
    }
  };

  if (!user || !['MODERATOR', 'ADMIN', 'SUPERADMIN'].includes(user.role)) {
    return <div className="text-center py-16 text-slate-400">Access Denied. Redirecting...</div>;
  }

  const filteredUploadLogs = uploadLogs.filter((log) => {
    if (filterType !== 'ALL' && log.uploadType !== filterType) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const formattedDate = new Date(log.createdAt).toLocaleString().toLowerCase();
    return (
      log.id.toLowerCase().includes(q) ||
      log.uploaderUsername.toLowerCase().includes(q) ||
      log.fileName.toLowerCase().includes(q) ||
      log.summary.toLowerCase().includes(q) ||
      formattedDate.includes(q)
    );
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-[#ff4d4d]" /> Administration Portal
        </h1>
        <p className="text-slate-400 mt-2 text-sm">
          Welcome back, {user.username} ({user.role}). Monitor reports, review user submissions, and secure quality standards.
        </p>
      </div>

      {/* Stats Summary Panel */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#1e293b] border border-[#334155] p-6 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-semibold">Total Accounts</span>
              <span className="text-2xl font-black text-white">{stats.totalUsers}</span>
            </div>
          </div>

          <div className="bg-[#1e293b] border border-[#334155] p-6 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-[#ff4d4d]/10 rounded-xl text-[#ff4d4d]">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-semibold">Approved Slangs</span>
              <span className="text-2xl font-black text-white">{stats.totalSlangs}</span>
            </div>
          </div>

          <div className="bg-[#1e293b] border border-[#334155] p-6 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-semibold">Moderation Queue</span>
              <span className="text-2xl font-black text-white">{stats.pendingReviews}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#334155] flex gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('queue')}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'queue' ? 'border-[#ff4d4d] text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Review Queue ({queue.length})
        </button>
        {['ADMIN', 'SUPERADMIN'].includes(user.role) && (
          <>
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'users' ? 'border-[#ff4d4d] text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Account Controls
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'logs' ? 'border-[#ff4d4d] text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              System Audit Logs ({logs.length})
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'import' ? 'border-[#ff4d4d] text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Import CSV
            </button>
            <button
              onClick={() => setActiveTab('uploads')}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === 'uploads' ? 'border-[#ff4d4d] text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Upload History
            </button>
          </>
        )}
      </div>

      {success && (
        <div className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 p-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-500/15 text-red-500 border border-red-500/25 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tab Panels */}
      {loading ? (
        <div className="text-center py-8 text-slate-400 animate-pulse">Syncing catalog logs...</div>
      ) : (
        <div>
          {/* 1. REVIEW QUEUE TAB */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              {queue.map((item) => (
                <div key={item.id} className="p-6 rounded-2xl bg-[#1e293b] border border-[#334155] space-y-4 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{item.word}</h3>
                      <div className="flex flex-wrap gap-2 items-center text-xs text-slate-400">
                        <span className="px-2 py-0.5 bg-slate-800 rounded">{item.originRegion}</span>
                        <span>Uploader: <strong className="text-slate-300">{item.uploader?.username || 'Anonymous'}</strong></span>
                        <span>Toxicity: 
                          <strong className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                            item.aiToxicityScore >= 60 ? 'bg-red-500/20 text-red-500' : item.aiToxicityScore >= 30 ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'
                          }`}>
                            {item.aiToxicityScore} pts
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Moderation Controls */}
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleReview(item.id, 'APPROVE')}
                        disabled={actionLoading === item.id}
                        className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-all cursor-pointer"
                      >
                        <Check className="h-4 w-4" /> Approve
                      </button>
                      <button
                        onClick={() => handleReview(item.id, 'REJECT')}
                        disabled={actionLoading === item.id}
                        className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-red-650 hover:bg-red-500 text-xs font-semibold text-white transition-all cursor-pointer"
                      >
                        <X className="h-4 w-4" /> Reject
                      </button>
                      <button
                        onClick={() => handleReview(item.id, 'HIDE')}
                        disabled={actionLoading === item.id}
                        className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
                      >
                        <Ban className="h-4 w-4" /> Hide
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-[#0f172a]/55 border border-[#334155]/50 p-4 rounded-xl">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Real Meaning</span>
                      <p className="text-slate-350">{item.meaning}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Emotional Usage</span>
                      <p className="text-slate-350">{item.emotionalMeaning}</p>
                    </div>
                    <div className="md:col-span-2 mt-2">
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">Usage Example</span>
                      <p className="text-slate-350 italic">&ldquo;{item.exampleSentence}&rdquo;</p>
                    </div>
                  </div>
                </div>
              ))}

              {queue.length === 0 && (
                <div className="text-center py-12 border border-dashed border-[#334155] rounded-2xl text-slate-500">
                  Moderation queue is clean. Good work!
                </div>
              )}
            </div>
          )}

          {/* 2. ACCOUNT CONTROLS TAB */}
          {activeTab === 'users' && ['ADMIN', 'SUPERADMIN'].includes(user.role) && (
            <div className="bg-[#1e293b] border border-[#334155] p-8 rounded-2xl space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-[#334155] pb-3">
                <ShieldAlert className="h-5 w-5 text-[#ff4d4d]" /> Warn / Suspend / Ban User accounts
              </h3>

              <form onSubmit={handleUserBan} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">
                    Target Username
                  </label>
                  <input
                    type="text"
                    required
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                    placeholder="e.g. spammer_123"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">
                      Security Action
                    </label>
                    <select
                      value={banType}
                      onChange={(e) => setBanType(e.target.value as any)}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white focus:outline-none"
                    >
                      <option value="TEMPORARY_SUSPEND">Temporary Suspend</option>
                      <option value="SHADOW_BAN">Silent Shadow Ban</option>
                      <option value="PERMANENT_BAN">Permanent Account Ban</option>
                      <option value="UNBAN">Revoke Bans (Unban)</option>
                    </select>
                  </div>

                  {banType === 'TEMPORARY_SUSPEND' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1.5">
                        Duration (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={suspendDays}
                        onChange={(e) => setSuspendDays(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1.5">
                    Reason for action
                  </label>
                  <textarea
                    rows={2}
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Spam uploads / communal slurs / abusive comments"
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-[#ff4d4d] hover:bg-[#e04343] text-sm font-bold text-white transition-all shadow-md cursor-pointer"
                >
                  Apply Account Action
                </button>
              </form>
            </div>
          )}

          {/* 3. AUDIT LOGS TAB */}
          {activeTab === 'logs' && ['ADMIN', 'SUPERADMIN'].includes(user.role) && (
            <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden shadow-md">
              <div className="p-4 bg-slate-800 border-b border-[#334155] flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-bold text-white">System Security Log Ledger</span>
              </div>
              <div className="divide-y divide-[#334155] max-h-[500px] overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>
                        Admin: <strong className="text-slate-200">{log.admin.username}</strong> ({log.admin.role})
                      </span>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-white">
                      Action Type: <span className="font-bold text-[#ff4d4d]">{log.actionType}</span>
                    </p>
                    <p className="text-slate-300">Reason: {log.reason}</p>
                    <div className="flex gap-4 text-slate-450 mt-1">
                      {log.targetPost && <span>Target Post ID: {log.targetPost}</span>}
                      {log.targetUser && <span>Target User ID: {log.targetUser}</span>}
                    </div>
                  </div>
                ))}

                {logs.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No actions logged in security ledger.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. CSV IMPORT TAB */}
          {activeTab === 'import' && ['ADMIN', 'SUPERADMIN'].includes(user.role) && (
            <div className="bg-[#1e293b] border border-[#334155] p-8 rounded-2xl space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-[#334155] pb-3">
                <FileText className="h-5 w-5 text-[#ff4d4d]" /> Bulk Import Slangs from CSV
              </h3>

              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Select a CSV file containing slang definitions. The file should have columns matching: 
                  <code className="bg-[#0f172a] px-1.5 py-0.5 rounded text-white ml-1 text-xs font-mono">
                    word, meaning, emotionalMeaning, exampleSentence, originRegion, language, severityLevel, isNsfw, tags
                  </code>
                </p>

                <div className="p-8 border-2 border-dashed border-[#334155] hover:border-[#ff4d4d]/60 rounded-xl bg-[#0f172a]/30 transition-all flex flex-col items-center justify-center gap-3">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-file-upload"
                  />
                  <label
                    htmlFor="csv-file-upload"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white rounded-lg border border-[#334155] cursor-pointer transition-all"
                  >
                    Choose CSV File
                  </label>
                  {selectedFile && (
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-emerald-400">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  )}
                </div>

                {importStats && (
                  <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                    <h4 className="text-sm font-bold text-emerald-400">🎉 Import Completed Successfully!</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs pt-1">
                      <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                        <span className="text-slate-400 block font-semibold">New Uploaded</span>
                        <span className="text-lg font-black text-white">{importStats.uploadedCount}</span>
                      </div>
                      <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                        <span className="text-slate-400 block font-semibold">Repeated (Skipped)</span>
                        <span className="text-lg font-black text-amber-400">{importStats.repeatedCount}</span>
                      </div>
                      <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                        <span className="text-slate-400 block font-semibold">Total Processed</span>
                        <span className="text-lg font-black text-white">{importStats.totalProcessed}</span>
                      </div>
                    </div>
                  </div>
                )}

                {importErrors.length > 0 && (
                  <div className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                    <h4 className="text-sm font-bold text-rose-450">❌ File Rejected: Formatting Errors Detected</h4>
                    <p className="text-xs text-slate-400">
                      The entire file was rejected to prevent data corruption. Please fix these rows in your CSV and try again:
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono text-rose-300 bg-[#0f172a]/60 p-3 rounded-lg border border-[#334155]/60">
                      {importErrors.map((err, idx) => (
                        <div key={idx} className="flex gap-1.5">
                          <span className="text-rose-500">•</span>
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleImportSubmit}
                  disabled={!selectedFile || importing}
                  className="w-full py-3 rounded-lg bg-[#ff4d4d] hover:bg-[#e04343] disabled:bg-slate-800 disabled:text-slate-500 disabled:pointer-events-none text-sm font-bold text-white transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {importing ? 'Processing & Uploading...' : 'Upload & Import Dataset'}
                </button>
              </div>
            </div>
          )}

          {/* 5. UPLOAD HISTORY TAB */}
          {activeTab === 'uploads' && ['ADMIN', 'SUPERADMIN'].includes(user.role) && (
            <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden shadow-md space-y-6 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#334155] pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#ff4d4d]" /> Upload History Ledger
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Audit and track all slang imports and single user/anonymous uploads.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  {/* Filter Dropdown */}
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="px-3 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-slate-200 text-xs font-semibold focus:outline-none focus:border-[#ff4d4d] cursor-pointer"
                  >
                    <option value="ALL">All Upload Types</option>
                    <option value="SYSTEM">System Imports (CSV)</option>
                    <option value="USER">User & Anon Uploads</option>
                  </select>

                  {/* Search bar */}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search username, ID, file, date..."
                    className="px-3 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 text-xs focus:outline-none focus:border-[#ff4d4d] w-full sm:w-60"
                  />
                </div>
              </div>

              {/* Logs Table / List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#334155]/85 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Log ID / Timestamp</th>
                      <th className="py-3 px-4">Uploader</th>
                      <th className="py-3 px-4">File Name / Context</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Status / Summary</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]/50 text-slate-200">
                    {filteredUploadLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/20 transition-all">
                        <td className="py-4 px-4 space-y-1">
                          <span className="font-mono text-[10px] text-slate-400 block truncate max-w-[120px]" title={log.id}>
                            {log.id}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-4 space-y-0.5">
                          <span className="font-bold text-slate-200 block">{log.uploaderUsername}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-bold uppercase inline-block">
                            {log.uploaderRole}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-slate-300 break-all max-w-[200px] inline-block">
                            {log.fileName}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider uppercase inline-block ${
                              log.uploadType === 'SYSTEM'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {log.uploadType === 'SYSTEM' ? 'SYSTEM (CSV)' : 'USER UPLOAD'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-slate-300 font-medium">{log.summary}</p>
                          <div className="flex gap-2.5 mt-1 text-[10px] text-slate-400">
                            <span>Uploaded: <strong className="text-emerald-400">{log.uploadedCount}</strong></span>
                            {log.uploadType === 'SYSTEM' && (
                              <span>Repeated: <strong className="text-amber-500">{log.repeatedCount}</strong></span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {log.uploadType === 'SYSTEM' && (
                            log.isReverted ? (
                              <span className="text-[10px] font-bold text-rose-500/80 bg-rose-500/5 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                                Rolled Back
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRollback(log.id)}
                                disabled={rollbackLoading !== null}
                                className="px-2.5 py-1 text-[10px] font-bold text-rose-450 hover:text-white border border-rose-500/30 hover:bg-[#ff4d4d] hover:border-[#ff4d4d] rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-1 ml-auto"
                              >
                                <RotateCcw className={`h-3 w-3 ${rollbackLoading === log.id ? 'animate-spin' : ''}`} />
                                {rollbackLoading === log.id ? 'Reverting...' : 'Rollback'}
                              </button>
                            )
                          )}
                          {log.uploadType === 'USER' && (
                            <span className="text-slate-500 text-[10px] italic">No actions</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {filteredUploadLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-500">
                          No matching upload logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
