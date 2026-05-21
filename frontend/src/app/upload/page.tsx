'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { PlusCircle, ShieldAlert, AlertTriangle, CheckSquare, Info } from 'lucide-react';

const REGIONS = [
  'Delhi', 'Uttar Pradesh', 'Bihar', 'West Bengal', 'Maharashtra', 'Punjab', 
  'Haryana', 'Rajasthan', 'Gujarat', 'Madhya Pradesh', 'Karnataka', 
  'Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Kerala', 'Northeast', 'Goa', 'Kashmir'
];

const LANGUAGES = [
  'Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Urdu', 'Bhojpuri', 'Punjabi', 'Assamese', 'Hinglish', 'English'
];

export default function UploadPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Form states
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [emotionalMeaning, setEmotionalMeaning] = useState('');
  const [exampleSentence, setExampleSentence] = useState('');
  const [originRegion, setOriginRegion] = useState('');
  const [language, setLanguage] = useState('');
  const [severity, setSeverity] = useState('MILD');
  const [tagsInput, setTagsInput] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Redirect to login if not logged in
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) return <div className="text-center py-12 text-slate-400">Redirecting to login...</div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!agreed) {
      setError('You must read and agree to the Terms & Community Guidelines.');
      return;
    }

    setLoading(true);

    // Process tags input (comma separated)
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t !== '');

    try {
      const res = await api.upload({
        word,
        meaning,
        emotionalMeaning,
        exampleSentence,
        originRegion,
        language,
        severity,
        tags
      });

      setSuccessMsg(res.message);
      
      // Reset form
      setWord('');
      setMeaning('');
      setEmotionalMeaning('');
      setExampleSentence('');
      setOriginRegion('');
      setLanguage('');
      setSeverity('MILD');
      setTagsInput('');
      setAgreed(false);
      window.scrollTo(0, 0);
    } catch (err: any) {
      setError(err.message || 'Validation failed during upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
          <PlusCircle className="h-8 w-8 text-[#ff4d4d]" /> Upload New Slang
        </h1>
        <p className="text-slate-400 mt-2 text-sm">
          Expand the archive! Contributions are processed through AI scan verification followed by manual moderator checks.
        </p>
      </div>

      {successMsg && (
        <div className="bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 p-4 rounded-xl text-sm leading-relaxed">
          <strong>Submission Received:</strong> {successMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-500/15 text-red-500 border border-red-500/30 p-4 rounded-xl text-sm flex items-start gap-2">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-[#1e293b] border border-[#334155] p-8 rounded-2xl shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Slang Word */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-350 mb-1.5" htmlFor="word">
              Slang Word / Expression
            </label>
            <input
              id="word"
              type="text"
              required
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="e.g. Bawa, Bokachoda, Chutiya"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all"
            />
          </div>

          {/* Real Meaning */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-350 mb-1.5" htmlFor="meaning">
              Real Dictionary Meaning (Without Censorship)
            </label>
            <textarea
              id="meaning"
              required
              rows={3}
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="Provide the exact literal translation or linguistic definition."
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all resize-none"
            />
          </div>

          {/* Emotional Usage Context */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-350 mb-1.5" htmlFor="emotionalMeaning">
              Usage Meaning & Emotional Context
            </label>
            <textarea
              id="emotionalMeaning"
              required
              rows={3}
              value={emotionalMeaning}
              onChange={(e) => setEmotionalMeaning(e.target.value)}
              placeholder="When is this term used? Is it funny, banter, angry, or extreme abuse?"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all resize-none"
            />
          </div>

          {/* Example Sentence */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-350 mb-1.5" htmlFor="exampleSentence">
              Example Sentence (How it is used)
            </label>
            <textarea
              id="exampleSentence"
              required
              rows={2}
              value={exampleSentence}
              onChange={(e) => setExampleSentence(e.target.value)}
              placeholder="Show a practical conversation sentence where this slang is spoken."
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all resize-none"
            />
          </div>

          {/* Origin State */}
          <div>
            <label className="block text-sm font-bold text-slate-350 mb-1.5" htmlFor="region">
              Region / State of Origin
            </label>
            <select
              id="region"
              required
              value={originRegion}
              onChange={(e) => setOriginRegion(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all cursor-pointer"
            >
              <option value="" disabled>Select State</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-bold text-slate-350 mb-1.5" htmlFor="language">
              Language
            </label>
            <select
              id="language"
              required
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all cursor-pointer"
            >
              <option value="" disabled>Select Language</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-bold text-slate-350 mb-1.5" htmlFor="severity">
              Vibe / Severity Level
            </label>
            <select
              id="severity"
              required
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all cursor-pointer"
            >
              <option value="MILD">Mild (Friendly / Exclamatory)</option>
              <option value="MEDIUM">Medium (Moderate abuse / Provocative)</option>
              <option value="EXTREME">Extreme (Highly vulgar / Severe abuse)</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-bold text-slate-350 mb-1.5" htmlFor="tags">
              Tags (Comma separated)
            </label>
            <input
              id="tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. friendly, angry, meme, funny"
              className="w-full px-4 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-white placeholder-slate-500 focus:outline-none focus:border-[#ff4d4d] focus:ring-1 focus:ring-[#ff4d4d] transition-all"
            />
          </div>
        </div>

        {/* Legal Agreements scrolling block */}
        <div className="space-y-3 border-t border-[#334155] pt-6">
          <label className="block text-sm font-bold text-slate-300">
            Mandatory Content Submission Agreement
          </label>
          <div className="h-32 overflow-y-auto text-xs text-slate-400 bg-[#0f172a] border border-[#334155] p-4 rounded-lg space-y-2.5 leading-relaxed scrollbar-thin">
            <p>
              By submitting content to this platform, you confirm that the uploaded slang, gaali, phrase, or expression is intended strictly for educational, cultural, linguistic, entertainment, or documentation purposes.
            </p>
            <p className="font-semibold text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> YOU AGREE NOT TO UPLOAD:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Personal attacks targeting real individuals.</li>
              <li>Hate speech against religion, caste, ethnicity, gender, nationality, or disability.</li>
              <li>Threats of physical violence.</li>
              <li>Doxxing or private information of any individual.</li>
              <li>Illegal or extremist political content.</li>
              <li>Sexually exploitative or harmful material.</li>
            </ul>
            <p>
              You understand that all submissions are reviewed by automated AI moderation systems and may also be manually reviewed by moderators before publication. The platform reserves the right to reject, edit, remove, or restrict any content that violates community guidelines.
            </p>
            <p>
              By uploading content, you grant the platform permission to display, categorize, and process the submission for search, recommendation, moderation, analytics, and educational purposes. The platform is not responsible for misuse of uploaded content by third parties. Repeated violations may result in suspension or permanent termination of your account.
            </p>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none pt-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4.5 w-4.5 rounded border-[#334155] bg-[#0f172a] text-[#ff4d4d] focus:ring-[#ff4d4d] cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-300">
              I agree to the Terms & Community Guidelines and certify this upload is strictly for linguistic archiving.
            </span>
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#ff4d4d] hover:bg-[#e04343] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover-scale disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          {loading ? 'Analyzing Content...' : 'Submit Entry to Moderator Queue'}
        </button>
      </form>
    </div>
  );
}
