'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { UserPlus, Mail, KeyRound, User, MapPin, AlertCircle, ArrowRight } from 'lucide-react';

const REGIONS = [
  'Delhi', 'Uttar Pradesh', 'Bihar', 'West Bengal', 'Maharashtra', 'Punjab', 
  'Haryana', 'Rajasthan', 'Gujarat', 'Madhya Pradesh', 'Karnataka', 
  'Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Kerala', 'Northeast', 'Goa', 'Kashmir'
];

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [region, setRegion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.signup({ username, email, password, region });
      login(res.token, res.user);
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Registration failed. Try a different username/email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center">
      <div className="w-full max-w-md p-8 rounded-2xl glass-card border border-[#334155]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white">Create Account</h1>
          <p className="text-slate-400 mt-2 text-sm">Join the Indian slang archive community</p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5" htmlFor="username">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-5 w-5" />
              </span>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="slang_lord"
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5" htmlFor="email">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-5 w-5" />
              </span>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <KeyRound className="h-5 w-5" />
              </span>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all"
              />
            </div>
          </div>

          {/* Region */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5" htmlFor="region">
              Your Region / State
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <MapPin className="h-5 w-5" />
              </span>
              <select
                id="region"
                required
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0f172a] border border-[#334155] text-white focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all appearance-none cursor-pointer"
              >
                <option value="" disabled className="text-slate-500">Select Region</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r} className="bg-[#0f172a]">{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#ff4d4d] hover:bg-[#e04343] text-white font-semibold py-2.5 px-4 rounded-lg transition-all shadow-lg hover-scale disabled:opacity-50 disabled:pointer-events-none mt-4"
          >
            {loading ? 'Registering...' : (
              <>
                Register Account <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-400">
          Already registered?{' '}
          <Link href="/login" className="font-semibold text-[#ff4d4d] hover:underline">
            Sign In instead
          </Link>
        </p>
      </div>
    </div>
  );
}
