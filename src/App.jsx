import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import i18nData from './i18n.json';

const API_BASE = 'http://localhost:8000/api';

// Baseline Persona: Ramesh Naidu
const RAMESH_NAIDU_PROFILE = {
  name: 'Ramesh Naidu',
  age: 52,
  gender: 'male',
  occupation: 'farmer',
  land_size: 2.0,
  family_size: 4,
  annual_income: 80000,
  state: 'Andhra Pradesh',
  category: 'OBC',
  is_income_tax_payer: false,
  is_govt_employee: false,
  owns_pucca_house: false
};

export default function App() {
  // Navigation & Localization
  const [screen, setScreen] = useState('splash'); // splash, language, profile, schemes, scheme_detail, pmkisan, help
  const [lang, setLang] = useState('te'); // default to Telugu for Ramesh Naidu
  const [fontScale, setFontScale] = useState(1); // 1 = normal (18px base), 1.15 = A+, 1.3 = A++
  
  // Profile State
  const [profile, setProfile] = useState(RAMESH_NAIDU_PROFILE);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const [parsingLoading, setParsingLoading] = useState(false);

  // Schemes State
  const [schemes, setSchemes] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [schemesLoading, setSchemesLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [checkedDocs, setCheckedDocs] = useState({});

  // PM-KISAN Status State
  const [pmQuery, setPmQuery] = useState('4892');
  const [pmStatus, setPmStatus] = useState(null);
  const [pmLoading, setPmLoading] = useState(false);

  // Audio Playback
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef(null);
  const t = i18nData[lang] || i18nData['en'];

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      const langMap = { te: 'te-IN', hi: 'hi-IN', en: 'en-IN' };
      recognition.lang = langMap[lang] || 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join('');
        setInputText(transcript);
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setMicError(t.mic_error_blocked);
        } else {
          setMicError(`Mic notice: ${event.error}. You can type below.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [lang, t]);

  // Text-To-Speech helper
  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const langMap = { te: 'te-IN', hi: 'hi-IN', en: 'en-IN' };
    utterance.lang = langMap[lang] || 'en-IN';
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setMicError('Speech recognition is not supported in this browser. Please type below.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setMicError(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        recognitionRef.current.stop();
      }
    }
  };

  // Parse spoken or typed text into profile fields
  const handleParseProfile = async (customText = null) => {
    const textToAnalyze = customText || inputText;
    if (!textToAnalyze || !textToAnalyze.trim()) return;

    setParsingLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/parse-profile`, {
        text: textToAnalyze,
        language: lang
      });
      setProfile((prev) => ({ ...prev, ...res.data }));
      setInputText('');
    } catch (err) {
      console.error('Error parsing profile:', err);
    } finally {
      setParsingLoading(false);
    }
  };

  // Evaluate schemes via backend rules engine
  const fetchEligibility = async (userProfile = profile) => {
    setSchemesLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/eligibility`, userProfile);
      setSchemes(res.data.results || []);
      setScreen('schemes');
    } catch (err) {
      console.error('Eligibility fetch error:', err);
      setScreen('schemes');
    } finally {
      setSchemesLoading(false);
    }
  };

  // PM-KISAN lookup
  const fetchPmKisanStatus = async (overrideQuery = null) => {
    const q = overrideQuery || pmQuery;
    setPmLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/pmkisan-status`, { query: q });
      setPmStatus(res.data);
    } catch (err) {
      console.error('PM-KISAN lookup error:', err);
    } finally {
      setPmLoading(false);
    }
  };

  // One-Tap Demo Setup
  const handleOneTapRamesh = () => {
    setProfile(RAMESH_NAIDU_PROFILE);
    setLang('te');
    fetchEligibility(RAMESH_NAIDU_PROFILE);
  };

  // Helper for localized scheme text
  const getLocalized = (obj) => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj['en'] || Object.values(obj)[0] || '';
  };

  // Base font size scaling for accessibility
  const dynamicFontSize = {
    fontSize: `${18 * fontScale}px`,
  };

  return (
    <div style={dynamicFontSize} className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* RESPONSIVE TOP NAVBAR */}
      <header className="bg-gradient-to-r from-[#C00000] via-[#D11A1A] to-[#E02424] text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            {screen !== 'splash' && (
              <button 
                onClick={() => {
                  if (screen === 'scheme_detail') setScreen('schemes');
                  else if (screen === 'schemes') setScreen('profile');
                  else setScreen('splash');
                }}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 flex items-center justify-center font-bold text-lg transition"
                title="Back"
              >
                ←
              </button>
            )}
            <div 
              onClick={() => setScreen('splash')}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <span className="text-3xl bg-white/10 p-1.5 rounded-2xl border border-white/20">🌾</span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-black text-2xl tracking-tight leading-none">
                    {t.app_name}
                  </h1>
                  <span className="hidden sm:inline-block text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-bold text-orange-100">
                    Rural Welfare AI
                  </span>
                </div>
                <p className="text-xs text-orange-100 font-medium opacity-90 hidden sm:block mt-0.5">
                  {t.auditable_badge}
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 font-bold text-sm bg-black/20 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => {
                if (schemes.length === 0) fetchEligibility();
                else setScreen('schemes');
              }}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                screen === 'schemes' || screen === 'scheme_detail' ? 'bg-white text-[#C00000] shadow' : 'text-white hover:bg-white/10'
              }`}
            >
              📜 Schemes
            </button>
            <button
              onClick={() => setScreen('profile')}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                screen === 'profile' ? 'bg-white text-[#C00000] shadow' : 'text-white hover:bg-white/10'
              }`}
            >
              🎙️ Speak / Profile
            </button>
            <button
              onClick={() => {
                if (!pmStatus) fetchPmKisanStatus('4892');
                setScreen('pmkisan');
              }}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                screen === 'pmkisan' ? 'bg-white text-[#C00000] shadow' : 'text-white hover:bg-white/10'
              }`}
            >
              🌾 PM-KISAN
            </button>
            <button
              onClick={() => setScreen('help')}
              className={`px-3.5 py-1.5 rounded-xl transition ${
                screen === 'help' ? 'bg-white text-[#C00000] shadow' : 'text-white hover:bg-white/10'
              }`}
            >
              📞 Help
            </button>
          </nav>

          {/* Right Action Tools: Font Resizer, Language Switch, Demo Button */}
          <div className="flex items-center gap-2">
            {/* 1-Tap Ramesh Quick Button on Desktop */}
            <button
              onClick={handleOneTapRamesh}
              className="hidden lg:flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-md transition"
              title="Quick demo as Ramesh Naidu"
            >
              <span>⚡</span>
              <span>Demo Persona</span>
            </button>

            {/* Font Accessibility Toggle */}
            <button
              onClick={() => setFontScale((s) => (s >= 1.25 ? 1 : s + 0.15))}
              className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold border border-white/30 active:scale-95 flex items-center gap-1 transition"
              title="Increase or decrease text size"
            >
              <span>A{fontScale > 1 ? '+' : ''}</span>
              <span className="hidden sm:inline text-[11px] font-normal">Text</span>
            </button>

            {/* Quick Language Switcher */}
            <div className="flex bg-black/30 rounded-xl p-0.5 text-xs font-bold border border-white/10">
              <button
                onClick={() => setLang('te')}
                className={`px-2 py-1 rounded-lg transition ${lang === 'te' ? 'bg-white text-[#C00000] shadow font-extrabold' : 'text-white hover:bg-white/10'}`}
              >
                తెలుగు
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`px-2 py-1 rounded-lg transition ${lang === 'hi' ? 'bg-white text-[#C00000] shadow font-extrabold' : 'text-white hover:bg-white/10'}`}
              >
                हिंदी
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-lg transition ${lang === 'en' ? 'bg-white text-[#C00000] shadow font-extrabold' : 'text-white hover:bg-white/10'}`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN RESPONSIVE CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* SCREEN 1: SPLASH / WELCOME HERO */}
        {screen === 'splash' && (
          <div className="py-6 sm:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Hero Headline & Persona Details */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 bg-red-100 text-[#C00000] px-3.5 py-1.5 rounded-full font-extrabold text-xs tracking-wide uppercase border border-red-200">
                  <span>🇮🇳</span>
                  <span>Voice-First Rural AI Assistant</span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                  {t.tagline}
                </h1>

                <p className="text-slate-600 font-medium text-base sm:text-lg leading-relaxed max-w-2xl">
                  Empowering rural Indian families to easily discover, verify eligibility, and claim their rightful government welfare schemes in their own mother tongue.
                </p>

                {/* Persona Spotlight Box */}
                <div className="bg-white border-2 border-orange-200 rounded-3xl p-5 sm:p-6 shadow-md hover:shadow-lg transition">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl bg-orange-100 p-3 rounded-2xl border border-orange-200">👨‍🌾</span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-extrabold text-slate-900 text-lg sm:text-xl">
                          Designed for Ramesh Naidu
                        </h2>
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                          Target Persona
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1">
                        52, Smallholder Farmer in Chittoor, AP • High school pass • Speaks Telugu • Fears middlemen and rejection.
                      </p>
                      <div className="mt-3 bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs sm:text-sm text-amber-950 font-medium">
                        ✨ <strong>Core Selling Point:</strong> Eligibility is determined strictly by a deterministic rules engine. Auditable, rule-by-rule reasons with official government links — zero LLM hallucinations.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Value Propositions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2.5">
                    <span className="text-xl">🎙️</span>
                    <span>Voice Input in Telugu, Hindi & English</span>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2.5">
                    <span className="text-xl">⚖️</span>
                    <span>Deterministic Auditable Rules Engine</span>
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2.5">
                    <span className="text-xl">🛡️</span>
                    <span>Zero Middlemen & No Hidden Fees</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Login & Quick Start Card */}
              <div className="lg:col-span-5 bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
                <div className="text-center pb-2 border-b border-slate-100">
                  <span className="text-4xl block mb-2">🤝</span>
                  <h2 className="text-2xl font-black text-slate-900">
                    Get Started With SahaayAI
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Select an entry mode to discover your eligible schemes.
                  </p>
                </div>

                {/* One-Tap Demo Button */}
                <button
                  onClick={handleOneTapRamesh}
                  className="w-full min-h-[58px] bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-base rounded-2xl shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <span>⚡</span>
                  <span>{t.demo_ramesh}</span>
                </button>

                {/* Mock DigiLocker Login */}
                <button
                  onClick={() => setScreen('language')}
                  className="w-full min-h-[58px] bg-[#003B73] hover:bg-[#002d59] text-white font-extrabold text-base rounded-2xl shadow-md active:scale-95 transition flex items-center justify-center gap-3 border border-blue-900"
                >
                  <span className="bg-white text-[#003B73] text-[11px] font-black px-2 py-0.5 rounded">
                    DEMO
                  </span>
                  <span>🔒 {t.login_digilocker}</span>
                </button>

                {/* Continue As Guest */}
                <button
                  onClick={() => setScreen('language')}
                  className="w-full min-h-[56px] bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-base rounded-2xl shadow-sm active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <span>{t.continue_guest} →</span>
                </button>

                <div className="pt-3 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                    <span>🛡️</span>
                    <span>{t.privacy_note}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2: LANGUAGE SELECTION */}
        {screen === 'language' && (
          <div className="max-w-4xl mx-auto py-8">
            <div className="text-center mb-8">
              <span className="text-5xl block mb-2">🗣️</span>
              <h2 className="text-3xl font-black text-slate-900">
                {t.select_language}
              </h2>
              <p className="text-slate-600 text-base mt-1">
                {t.select_lang_sub}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Telugu */}
              <div 
                onClick={() => {
                  setLang('te');
                  speakText('నమస్కారం! సహాయ్ ఎఐ కి స్వాగతం.');
                  setScreen('profile');
                }}
                className={`cursor-pointer rounded-3xl p-6 border-3 transition shadow-md hover:shadow-xl flex flex-col justify-between min-h-[200px] ${
                  lang === 'te' 
                    ? 'border-[#C00000] bg-red-50/70 ring-4 ring-red-200' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-3xl">🌾</span>
                    <span className="text-xs bg-red-100 text-[#C00000] font-bold px-2.5 py-1 rounded-full">
                      ఆంధ్రప్రదేశ్
                    </span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mt-4">తెలుగు</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Telugu (AP & Telangana)</p>
                </div>
                <button className="mt-4 w-full py-2.5 bg-[#C00000] text-white font-bold rounded-xl text-sm">
                  ఎంచుకోండి →
                </button>
              </div>

              {/* Hindi */}
              <div 
                onClick={() => {
                  setLang('hi');
                  speakText('नमस्ते! सहाय एआई में आपका स्वागत है।');
                  setScreen('profile');
                }}
                className={`cursor-pointer rounded-3xl p-6 border-3 transition shadow-md hover:shadow-xl flex flex-col justify-between min-h-[200px] ${
                  lang === 'hi' 
                    ? 'border-[#C00000] bg-red-50/70 ring-4 ring-red-200' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-3xl">🇮🇳</span>
                    <span className="text-xs bg-orange-100 text-orange-800 font-bold px-2.5 py-1 rounded-full">
                      राष्ट्रीय
                    </span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mt-4">हिंदी</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Hindi (North & Central India)</p>
                </div>
                <button className="mt-4 w-full py-2.5 bg-[#C00000] text-white font-bold rounded-xl text-sm">
                  चुनें →
                </button>
              </div>

              {/* English */}
              <div 
                onClick={() => {
                  setLang('en');
                  speakText('Welcome to SahaayAI.');
                  setScreen('profile');
                }}
                className={`cursor-pointer rounded-3xl p-6 border-3 transition shadow-md hover:shadow-xl flex flex-col justify-between min-h-[200px] ${
                  lang === 'en' 
                    ? 'border-[#C00000] bg-red-50/70 ring-4 ring-red-200' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-3xl">🌐</span>
                    <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full">
                      Global
                    </span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mt-4">English</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Simple Plain English</p>
                </div>
                <button className="mt-4 w-full py-2.5 bg-[#C00000] text-white font-bold rounded-xl text-sm">
                  Select →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 3: PROFILE INPUT (SPEAK NOW) */}
        {screen === 'profile' && (
          <div className="py-4">
            <div className="text-center max-w-2xl mx-auto mb-6">
              <h2 className="text-3xl font-black text-slate-900">
                {t.screen_speak_title}
              </h2>
              <p className="text-slate-600 text-base mt-1">
                {t.screen_speak_subtitle}
              </p>
            </div>

            {/* 2-Column Responsive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Voice & Typing Input */}
              <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-sm flex flex-col items-center justify-between space-y-5">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Voice Input Mode
                  </span>

                  {/* Pulsing Mic Button */}
                  <button
                    onClick={toggleListening}
                    className={`relative w-32 h-32 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all duration-300 active:scale-95 my-2 ${
                      isListening 
                        ? 'bg-red-600 ring-8 ring-red-200 animate-pulse scale-105' 
                        : 'bg-gradient-to-tr from-[#C00000] to-[#F26A2A] hover:opacity-95'
                    }`}
                    title="Speak Now"
                  >
                    {isListening ? (
                      <div className="flex items-center gap-1.5 h-12">
                        <span className="w-1.5 bg-white rounded-full animate-wave-1"></span>
                        <span className="w-1.5 bg-white rounded-full animate-wave-2"></span>
                        <span className="w-1.5 bg-white rounded-full animate-wave-3"></span>
                        <span className="w-1.5 bg-white rounded-full animate-wave-4"></span>
                        <span className="w-1.5 bg-white rounded-full animate-wave-5"></span>
                      </div>
                    ) : (
                      <>
                        <span className="text-4xl mb-1">🎙️</span>
                        <span className="text-xs font-bold tracking-wide">
                          {t.mic_tap_to_speak}
                        </span>
                      </>
                    )}
                  </button>

                  <span className="text-xs font-semibold text-slate-500 mt-2">
                    {isListening ? t.mic_listening : 'Browser Web Speech API (te-IN / hi-IN / en-IN)'}
                  </span>

                  {micError && (
                    <div className="mt-3 text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-200 text-center w-full">
                      {micError}
                    </div>
                  )}
                </div>

                {/* Text Fallback Box */}
                <div className="w-full space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>⌨️ Spoken / Typed Transcript:</span>
                    {inputText && (
                      <button 
                        onClick={() => setInputText('')}
                        className="text-red-500 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t.typing_placeholder}
                    className="w-full text-base p-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-400 focus:outline-none"
                  />
                  <button
                    onClick={() => handleParseProfile()}
                    disabled={parsingLoading || !inputText.trim()}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-sm disabled:opacity-40 active:scale-95 transition"
                  >
                    {parsingLoading ? 'Extracting Fields...' : t.submit_text}
                  </button>

                  {/* Sample Prompt Chip */}
                  <button
                    onClick={() => {
                      const sample = lang === 'te' 
                        ? 'నేను రైతును, నాకు 2 ఎకరాల భూమి ఉంది, 4 మంది కుటుంబ సభ్యులు, వార్షిక ఆదాయం 80,000'
                        : lang === 'hi'
                        ? 'मैं किसान हूं, मेरे पास 2 एकड़ जमीन है, 4 सदस्य हैं, वार्षिक आय 80000 रुपये'
                        : 'I am a farmer, I have 2 acres of land, 4 family members, income 80,000';
                      setInputText(sample);
                      handleParseProfile(sample);
                    }}
                    className="w-full text-left text-xs text-orange-800 bg-orange-50 hover:bg-orange-100 p-2.5 rounded-xl border border-orange-200 font-medium flex items-center gap-2"
                  >
                    <span>💡</span>
                    <span className="truncate">{t.example_chip}</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Interactive Profile Card */}
              <div className="lg:col-span-7 bg-white rounded-3xl border-2 border-slate-200 p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📋</span>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-lg">
                        {t.profile_card_title}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Extracted values from speech. Tap any chip to adjust.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-300">
                    Live Verified
                  </span>
                </div>

                {/* Profile Fields & Quick Chips */}
                <div className="space-y-4">
                  {/* Occupation */}
                  <div>
                    <div className="flex justify-between items-center text-sm font-semibold text-slate-700 mb-1.5">
                      <span>{t.occupation}:</span>
                      <span className="capitalize bg-slate-100 text-slate-900 px-3 py-0.5 rounded-lg font-bold">
                        {profile.occupation || 'Farmer'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['farmer', 'laborer', 'artisan', 'student'].map((occ) => (
                        <button
                          key={occ}
                          onClick={() => setProfile((p) => ({ ...p, occupation: occ }))}
                          className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition ${
                            profile.occupation === occ 
                              ? 'bg-red-600 text-white border-red-600 shadow' 
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {occ === 'farmer' ? '🌾 Farmer' : occ === 'laborer' ? '👷 Laborer' : occ === 'student' ? '🎓 Student' : '🧵 Artisan'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Land Size */}
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center text-sm font-semibold text-slate-700 mb-1.5">
                      <span>{t.land_size}:</span>
                      <span className="bg-slate-100 text-slate-900 px-3 py-0.5 rounded-lg font-bold">
                        {profile.land_size !== null ? `${profile.land_size} Acres` : 'Landless'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[0, 1.0, 2.0, 3.5, 5.0, 10.0].map((acres) => (
                        <button
                          key={acres}
                          onClick={() => setProfile((p) => ({ ...p, land_size: acres }))}
                          className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition ${
                            profile.land_size === acres 
                              ? 'bg-red-600 text-white border-red-600 shadow' 
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {acres === 0 ? '0 (Landless)' : `${acres} ac`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Annual Income */}
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center text-sm font-semibold text-slate-700 mb-1.5">
                      <span>{t.annual_income}:</span>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-0.5 rounded-lg font-bold">
                        ₹{profile.annual_income ? Number(profile.annual_income).toLocaleString('en-IN') : '80,000'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[40000, 80000, 120000, 200000, 500000].map((inc) => (
                        <button
                          key={inc}
                          onClick={() => setProfile((p) => ({ ...p, annual_income: inc }))}
                          className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition ${
                            profile.annual_income === inc 
                              ? 'bg-red-600 text-white border-red-600 shadow' 
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          ₹{(inc / 1000).toFixed(0)}k
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Family Size, Age, State in 3-column grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 block mb-1">{t.family_size}</span>
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => setProfile(p => ({ ...p, family_size: Math.max(1, (p.family_size || 4) - 1) }))}
                          className="w-7 h-7 rounded-lg bg-slate-200 font-bold"
                        >-</button>
                        <span className="font-extrabold text-base text-slate-900">{profile.family_size || 4}</span>
                        <button 
                          onClick={() => setProfile(p => ({ ...p, family_size: (p.family_size || 4) + 1 }))}
                          className="w-7 h-7 rounded-lg bg-slate-200 font-bold"
                        >+</button>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 block mb-1">{t.age}</span>
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => setProfile(p => ({ ...p, age: Math.max(18, (p.age || 52) - 1) }))}
                          className="w-7 h-7 rounded-lg bg-slate-200 font-bold"
                        >-</button>
                        <span className="font-extrabold text-base text-slate-900">{profile.age || 52} yrs</span>
                        <button 
                          onClick={() => setProfile(p => ({ ...p, age: (p.age || 52) + 1 }))}
                          className="w-7 h-7 rounded-lg bg-slate-200 font-bold"
                        >+</button>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col justify-between">
                      <span className="text-xs font-semibold text-slate-500 block mb-1">{t.state}</span>
                      <span className="font-extrabold text-sm text-slate-900">
                        {profile.state || 'Andhra Pradesh'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Big Action Button */}
                <button
                  onClick={() => fetchEligibility()}
                  disabled={schemesLoading}
                  className="w-full min-h-[58px] bg-[#C00000] hover:bg-[#a00000] active:scale-98 transition text-white font-extrabold text-lg sm:text-xl rounded-2xl shadow-xl flex items-center justify-center gap-2 border-2 border-red-700"
                >
                  {schemesLoading ? (
                    <span>🔄 Running Rules Engine...</span>
                  ) : (
                    <span>{t.confirm_btn} →</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 4: ELIGIBLE SCHEMES LIST */}
        {screen === 'schemes' && (
          <div className="py-4 space-y-6">
            {/* Top Stats & Filters Banner */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  {t.schemes_title}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {t.schemes_sub}
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-4 py-2 rounded-xl transition ${
                    activeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t.filter_all} ({schemes.length})
                </button>
                <button
                  onClick={() => setActiveFilter('eligible')}
                  className={`px-4 py-2 rounded-xl transition ${
                    activeFilter === 'eligible' ? 'bg-emerald-700 text-white shadow' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  ✓ {t.filter_eligible} ({schemes.filter(s => s.eligible).length})
                </button>
                <button
                  onClick={() => setActiveFilter('agri')}
                  className={`px-4 py-2 rounded-xl transition ${
                    activeFilter === 'agri' ? 'bg-orange-600 text-white shadow' : 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200'
                  }`}
                >
                  🌾 {t.filter_agri}
                </button>
              </div>
            </div>

            {/* Scheme Cards Grid: 1 col on mobile, 2 col on tablet, 3 col on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {schemes
                .filter((s) => {
                  if (activeFilter === 'eligible') return s.eligible;
                  if (activeFilter === 'agri') return s.category_tag === 'agriculture';
                  return true;
                })
                .map((scheme) => (
                  <div
                    key={scheme.scheme_id}
                    className={`rounded-3xl p-5 border-2 transition shadow-sm hover:shadow-md flex flex-col justify-between bg-white ${
                      scheme.eligible ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 opacity-90'
                    }`}
                  >
                    <div>
                      {/* Badge and Tag */}
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 ${
                            scheme.eligible
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {scheme.eligible ? `✓ ${t.eligible_badge}` : `✕ ${t.not_eligible_badge}`}
                        </span>

                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide bg-slate-100 px-2.5 py-1 rounded-lg">
                          {scheme.category_tag}
                        </span>
                      </div>

                      {/* Scheme Name */}
                      <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl leading-snug">
                        {getLocalized(scheme.name)}
                      </h3>

                      {/* Benefit Amount */}
                      <div className="mt-3 p-3 rounded-2xl bg-orange-50 border border-orange-200 text-orange-950 text-sm font-semibold flex items-baseline gap-2">
                        <span className="text-xl font-black text-[#C00000]">💰</span>
                        <span className="leading-snug">{getLocalized(scheme.benefit)}</span>
                      </div>

                      {/* Auditable Reason */}
                      <div className="mt-3 text-xs text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <span className="font-bold text-slate-900 block mb-1">
                          {t.rule_reason}
                        </span>
                        {scheme.eligible ? (
                          <span className="text-emerald-800 font-medium">
                            ✓ {scheme.one_line_reason}
                          </span>
                        ) : (
                          <div className="text-rose-700">
                            <span className="block font-medium">✕ {scheme.one_line_reason}</span>
                            <span className="block text-slate-500 mt-1 italic text-[11px]">
                              {scheme.fix_suggestion}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Source Link */}
                      {scheme.source_url && (
                        <div className="mt-2.5 text-[11px] text-slate-500 flex items-center gap-1">
                          <span>🔗</span>
                          <a 
                            href={scheme.source_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-blue-600 underline font-medium truncate"
                          >
                            {scheme.source_url}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                      <button
                        onClick={async () => {
                          try {
                            const res = await axios.get(`${API_BASE}/schemes/${scheme.scheme_id}`);
                            setSelectedScheme(res.data);
                            setScreen('scheme_detail');
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="min-h-[48px] bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold py-2 px-3 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-slate-300"
                      >
                        <span>📄</span>
                        <span>{t.btn_documents}</span>
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            const res = await axios.get(`${API_BASE}/schemes/${scheme.scheme_id}`);
                            setSelectedScheme(res.data);
                            setScreen('scheme_detail');
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`min-h-[48px] text-white font-bold py-2 px-3 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow active:scale-95 ${
                          scheme.eligible ? 'bg-[#C00000] hover:bg-[#a00000]' : 'bg-slate-700'
                        }`}
                      >
                        <span>{t.btn_apply} →</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* SCREEN 5: SCHEME DETAIL */}
        {screen === 'scheme_detail' && selectedScheme && (
          <div className="py-4 space-y-6">
            <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-8 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Scheme Information */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1 rounded-full uppercase">
                      {selectedScheme.category_tag}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Official Scheme</span>
                  </div>

                  <h2 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight">
                    {getLocalized(selectedScheme.name)}
                  </h2>

                  <p className="text-base text-slate-600 leading-relaxed">
                    {getLocalized(selectedScheme.description)}
                  </p>

                  {/* Benefit Banner */}
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                    <span className="text-xs font-bold text-red-700 block uppercase mb-1">
                      {t.benefit_label}:
                    </span>
                    <span className="text-xl font-black text-slate-900">
                      {getLocalized(selectedScheme.benefit)}
                    </span>
                  </div>

                  {/* Audio Read Aloud */}
                  <button
                    onClick={() => {
                      const speechText = `${getLocalized(selectedScheme.name)}. ${getLocalized(selectedScheme.benefit)}. ${t.docs_title}: ${selectedScheme.documents?.map(d => getLocalized(d.name)).join(', ')}`;
                      speakText(speechText);
                    }}
                    className="w-full min-h-[52px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-bold py-2.5 px-4 rounded-2xl text-sm sm:text-base flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <span>{isSpeaking ? '⏹️ Stop Voice' : t.btn_voice_listen}</span>
                  </button>

                  {/* Where to apply */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <span>📍</span> {t.where_apply_title}
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">
                      {getLocalized(selectedScheme.where_to_apply)}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="bg-white px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold">🏢 Rythu Bharosa Kendra (RBK)</span>
                      <span className="bg-white px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold">🏛️ Grama Sachivalayam</span>
                      <span className="bg-white px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold">💻 CSC Digital Seva</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Required Documents Checklist */}
                <div className="lg:col-span-5 bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b pb-2 mb-3">
                      <h3 className="font-extrabold text-slate-900 text-lg">
                        {t.docs_title}
                      </h3>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                        {Object.values(checkedDocs).filter(Boolean).length} / {selectedScheme.documents?.length || 0} {t.docs_ready_count}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 mb-4">
                      {t.docs_sub}
                    </p>

                    <div className="space-y-2.5">
                      {selectedScheme.documents?.map((doc) => {
                        const isChecked = !!checkedDocs[doc.id];
                        return (
                          <div
                            key={doc.id}
                            onClick={() => setCheckedDocs(prev => ({ ...prev, [doc.id]: !isChecked }))}
                            className={`p-3.5 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition select-none ${
                              isChecked 
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm' 
                                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-sm border ${
                                isChecked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 border-slate-300'
                              }`}>
                                {isChecked ? '✓' : ''}
                              </div>
                              <span className="font-semibold text-sm">
                                {getLocalized(doc.name)}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-400">
                              {isChecked ? 'Ready' : 'Tick'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Source rule link and back */}
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    {selectedScheme.source_url && (
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900">
                        <span className="font-bold block mb-0.5">⚖️ {t.official_rule_source}:</span>
                        <a 
                          href={selectedScheme.source_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-blue-700 underline break-all font-mono text-[11px]"
                        >
                          {selectedScheme.source_url}
                        </a>
                      </div>
                    )}

                    <button
                      onClick={() => setScreen('schemes')}
                      className="w-full min-h-[52px] bg-slate-900 hover:bg-slate-800 text-white font-bold text-base rounded-2xl active:scale-95 transition"
                    >
                      ← Back to Schemes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 6: PM-KISAN STATUS CHECK */}
        {screen === 'pmkisan' && (
          <div className="max-w-4xl mx-auto py-6 space-y-6">
            <div className="text-center max-w-xl mx-auto">
              <span className="text-5xl block mb-2">🌾</span>
              <h2 className="text-3xl font-black text-slate-900">
                {t.pmkisan_title}
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                {t.pmkisan_sub}
              </p>
            </div>

            {/* Quick Demo Pre-fill Chips */}
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => {
                  setPmQuery('4892');
                  fetchPmKisanStatus('4892');
                }}
                className="text-xs sm:text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold px-4 py-2 rounded-xl active:scale-95 hover:bg-emerald-100 transition"
              >
                {t.sample_ramesh_btn}
              </button>
              <button
                onClick={() => {
                  setPmQuery('1234');
                  fetchPmKisanStatus('1234');
                }}
                className="text-xs sm:text-sm bg-amber-50 border border-amber-300 text-amber-900 font-bold px-4 py-2 rounded-xl active:scale-95 hover:bg-amber-100 transition"
              >
                {t.sample_pending_btn}
              </button>
            </div>

            {/* Search Input Box */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={10}
                  value={pmQuery}
                  onChange={(e) => setPmQuery(e.target.value)}
                  placeholder={t.enter_aadhaar_placeholder}
                  className="flex-1 p-3.5 border border-slate-200 rounded-2xl font-bold text-base tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  onClick={() => fetchPmKisanStatus()}
                  disabled={pmLoading}
                  className="min-h-[52px] bg-[#C00000] hover:bg-[#a00000] text-white font-bold px-6 rounded-2xl text-sm active:scale-95 transition"
                >
                  {pmLoading ? '...' : t.check_status_btn}
                </button>
              </div>
            </div>

            {/* PM-KISAN Result Box: Responsive 2-column or full width */}
            {pmStatus && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Beneficiary Card & Stepper */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Beneficiary Card */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex flex-wrap justify-between items-start border-b pb-3 mb-3 gap-2">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-xl">
                          {pmStatus.beneficiary_name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Reg ID: {pmStatus.registration_number}
                        </p>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-900 font-bold px-3 py-1 rounded-full">
                        {pmStatus.village}, {pmStatus.district}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm text-slate-600">
                      <div>Aadhaar: <strong className="text-slate-900 block">{pmStatus.aadhaar_masked}</strong></div>
                      <div>Mobile: <strong className="text-slate-900 block">{pmStatus.mobile_masked}</strong></div>
                      <div>DBT Bank: <strong className="text-slate-900 block">{pmStatus.dbt_bank_status}</strong></div>
                      <div>Land 1B: <strong className="text-slate-900 block">{pmStatus.land_seeding}</strong></div>
                    </div>
                  </div>

                  {/* 4-Stage Stepper */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                    <h4 className="font-extrabold text-slate-900 text-base mb-6">
                      Application Lifecycle Progress:
                    </h4>
                    <div className="flex items-center justify-between relative px-4">
                      {/* Line */}
                      <div className="absolute top-5 left-8 right-8 h-1.5 bg-slate-200 -z-0"></div>
                      <div 
                        className="absolute top-5 left-8 h-1.5 bg-emerald-500 -z-0 transition-all duration-500"
                        style={{ width: `${((pmStatus.active_step - 1) / 3) * 82}%` }}
                      ></div>

                      {[
                        { step: 1, label: t.step_applied },
                        { step: 2, label: t.step_verified },
                        { step: 3, label: t.step_processing },
                        { step: 4, label: t.step_approved },
                      ].map((s) => {
                        const isCompleted = pmStatus.active_step >= s.step;
                        const isCurrent = pmStatus.active_step === s.step;
                        return (
                          <div key={s.step} className="flex flex-col items-center z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition ${
                              isCompleted 
                                ? 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-100 shadow' 
                                : 'bg-white text-slate-400 border-slate-300'
                            }`}>
                              {isCompleted ? '✓' : s.step}
                            </div>
                            <span className={`text-xs mt-2 font-bold ${
                              isCurrent ? 'text-emerald-700' : 'text-slate-500'
                            }`}>
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Status Action & Installment History */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Status Action Card */}
                  <div className={`p-5 rounded-3xl border-2 ${
                    pmStatus.active_step === 4 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}>
                    <h4 className="font-black text-base mb-1.5 flex items-center gap-2">
                      <span>{pmStatus.active_step === 4 ? '✅' : '⚠️'}</span>
                      <span>{pmStatus.status_title}</span>
                    </h4>
                    <p className="text-xs sm:text-sm font-medium mb-3 leading-relaxed">
                      {pmStatus.why_message}
                    </p>
                    <div className="bg-white/90 p-3.5 rounded-2xl border border-current text-xs sm:text-sm font-semibold">
                      <span className="block font-bold mb-1 text-slate-900">💡 Action / Fix:</span>
                      <span className="text-slate-800">{pmStatus.fix_suggestion}</span>
                    </div>
                  </div>

                  {/* Installment History Table */}
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                    <h4 className="font-extrabold text-slate-900 text-base mb-3">
                      {t.installments_title}
                    </h4>
                    <div className="space-y-2.5">
                      {pmStatus.installments?.map((inst) => (
                        <div 
                          key={inst.number}
                          className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs sm:text-sm"
                        >
                          <div>
                            <span className="font-extrabold text-slate-900 block">
                              Installment #{inst.number} (₹{inst.amount})
                            </span>
                            <span className="text-xs text-slate-500">
                              {inst.period} • {inst.bank}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                              inst.status === 'Credited' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {inst.status}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-1">
                              {inst.date}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 7: HELP */}
        {screen === 'help' && (
          <div className="max-w-4xl mx-auto py-6 space-y-6">
            <div className="text-center max-w-xl mx-auto">
              <span className="text-5xl block mb-2">📞</span>
              <h2 className="text-3xl font-black text-slate-900">
                {t.help_title}
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                {t.help_sub}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kisan Call Centre */}
              <div className="p-6 bg-orange-50 rounded-3xl border-2 border-orange-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">
                    National Government Service
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    Kisan Call Centre (22 Languages)
                  </h3>
                  <span className="text-3xl font-black text-[#C00000] block my-2">
                    155261
                  </span>
                  <p className="text-xs text-slate-600">
                    Toll-free • Available 6:00 AM - 10:00 PM every day for all agricultural queries.
                  </p>
                </div>
                <a
                  href="tel:155261"
                  className="mt-4 min-h-[50px] bg-[#C00000] hover:bg-[#a00000] text-white font-bold rounded-2xl text-sm flex items-center justify-center shadow"
                >
                  Call 155261 Now
                </a>
              </div>

              {/* AP Rythu Seva */}
              <div className="p-6 bg-slate-100 rounded-3xl border-2 border-slate-300 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                    State Government Support
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    AP Rythu Seva Toll-Free
                  </h3>
                  <span className="text-3xl font-black text-slate-900 block my-2">
                    1800-425-4440
                  </span>
                  <p className="text-xs text-slate-600">
                    Andhra Pradesh Agriculture Department Direct Helpdesk.
                  </p>
                </div>
                <a
                  href="tel:18004254440"
                  className="mt-4 min-h-[50px] bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-sm flex items-center justify-center shadow"
                >
                  Call 1800-425-4440
                </a>
              </div>
            </div>

            {/* CSC & Rythu Bharosa Kendra Locator Box */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <span>📍</span>
                <span>{t.csc_locator_title}</span>
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t.csc_locator_desc}
              </p>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs sm:text-sm text-slate-800">
                <span className="font-bold text-amber-950 block mb-1.5">💡 Tips for Village Visit:</span>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
                  <li>Always carry your original Aadhaar card and active mobile phone for OTP.</li>
                  <li>Carry 1B Land Passbook photocopy or tenancy agreement if applicable.</li>
                  <li><strong>Never pay cash to any middleman.</strong> Applications and e-KYC are 100% free at Rythu Bharosa Kendras and Grama Sachivalayams.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE STICKY BOTTOM NAVIGATION BAR (md:hidden) */}
      {screen !== 'splash' && (
        <nav className="md:hidden bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-around sticky bottom-0 z-40 shadow-xl">
          <button
            onClick={() => {
              if (schemes.length === 0) fetchEligibility();
              else setScreen('schemes');
            }}
            className={`flex flex-col items-center text-xs font-bold transition py-1 px-2 rounded-xl ${
              screen === 'schemes' || screen === 'scheme_detail' ? 'text-[#C00000]' : 'text-slate-500'
            }`}
          >
            <span className="text-xl">📜</span>
            <span>Schemes</span>
          </button>

          <button
            onClick={() => setScreen('profile')}
            className={`flex flex-col items-center text-xs font-bold transition py-1 px-2 rounded-xl ${
              screen === 'profile' ? 'text-[#C00000]' : 'text-slate-500'
            }`}
          >
            <span className="text-xl">🎙️</span>
            <span>Speak</span>
          </button>

          <button
            onClick={() => {
              if (!pmStatus) fetchPmKisanStatus('4892');
              setScreen('pmkisan');
            }}
            className={`flex flex-col items-center text-xs font-bold transition py-1 px-2 rounded-xl ${
              screen === 'pmkisan' ? 'text-[#C00000]' : 'text-slate-500'
            }`}
          >
            <span className="text-xl">🌾</span>
            <span>PM-KISAN</span>
          </button>

          <button
            onClick={() => setScreen('help')}
            className={`flex flex-col items-center text-xs font-bold transition py-1 px-2 rounded-xl ${
              screen === 'help' ? 'text-[#C00000]' : 'text-slate-500'
            }`}
          >
            <span className="text-xl">📞</span>
            <span>Help</span>
          </button>
        </nav>
      )}

      {/* RESPONSIVE FOOTER ON DESKTOP & TABLETS */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌾</span>
            <span className="font-bold text-white text-sm">SahaayAI</span>
            <span>—</span>
            <span>Auditable, voice-first welfare scheme discovery for rural Indian citizens</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-medium">
            <span>🛡️ 100% Privacy Protected</span>
            <span>•</span>
            <span>⚖️ Codified Rules Engine</span>
            <span>•</span>
            <span>🇮🇳 Andhra Pradesh & Central Schemes</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
