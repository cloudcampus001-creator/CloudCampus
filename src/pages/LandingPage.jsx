import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';

/* ─────────────────────────────────────────────────────────────
   CloudCampus — Landing Page
   • "Get Started Free" / "Sign In" / "Start Free Today" → /select-school
   • Auto-login (useStartupRedirect in App.jsx) fires before this
     renders, so existing sessions are handled transparently.
───────────────────────────────────────────────────────────── */

const LandingPage = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showBtt, setShowBtt] = useState(false);

  const goToSchool = () => navigate('/select-school');

  // ── Contact form state ───────────────────────────────────────
  const [contactForm,    setContactForm]    = React.useState({ name: '', email: '', message: '' });
  const [contactSending, setContactSending] = React.useState(false);
  const [contactSent,    setContactSent]    = React.useState(false);
  const [contactError,   setContactError]   = React.useState('');

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactSending(true);
    setContactError('');
    try {
      // Web3Forms — free email relay. Key is designed to be public.
      // Get yours at https://web3forms.com/ using cloudcampus001@gmail.com
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: 'd3194771-5f79-40bd-8b4d-cb6d3e8e44b9',
          name:       contactForm.name,
          email:      contactForm.email,
          message:    contactForm.message,
          subject:    `CloudCampus contact: ${contactForm.name}`,
          from_name:  'CloudCampus Website',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContactSent(true);
        setContactForm({ name: '', email: '', message: '' });
      } else {
        setContactError(data.message || 'Failed to send. Please try again.');
      }
    } catch (err) {
      setContactError('Network error. Please try again.');
    } finally {
      setContactSending(false);
    }
  };

  // ── Navbar scroll state ──────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      setShowBtt(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Scroll reveal ────────────────────────────────────────────
  useEffect(() => {
    const els = document.querySelectorAll('.cc-reveal');
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('cc-show')),
      { threshold: 0.12 }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // ── Count-up ─────────────────────────────────────────────────
  useEffect(() => {
    const els = document.querySelectorAll('.cc-count');
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const target = +el.dataset.target;
          const duration = 1600;
          const start = performance.now();
          const update = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.floor(ease * target);
            if (p < 1) requestAnimationFrame(update);
            else el.textContent = target;
          };
          requestAnimationFrame(update);
          obs.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>CloudCampus — Smart School Management</title>
        <meta name="description" content="CloudCampus connects administrators, teachers, vice principals, discipline masters and parents in one seamless platform." />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Helmet>

      {/* ── Injected CSS for animations not covered by Tailwind ── */}
      <style>{`
        * { font-family: 'Poppins', sans-serif; }
        .cc-reveal { opacity: 0; transform: translateY(36px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .cc-reveal.cc-show { opacity: 1; transform: translateY(0); }
        .cc-d1 { transition-delay: 0.1s; }
        .cc-d2 { transition-delay: 0.2s; }
        .cc-d3 { transition-delay: 0.3s; }
        .cc-d4 { transition-delay: 0.4s; }

        .cc-gradient-text {
          background: linear-gradient(135deg, #3b82f6, #ec4899);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .cc-gradient-text-blue {
          background: linear-gradient(135deg, #1e3a8a, #60a5fa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .cc-hero-grid {
          background-image: linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 50px 50px;
        }
        .cc-blob { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
        .cc-float { animation: ccFloat 6s ease-in-out infinite; }
        .cc-float-d1 { animation: ccFloat 7s ease-in-out infinite; animation-delay: -3s; }
        .cc-float-d2 { animation: ccFloat 5.5s ease-in-out infinite; animation-delay: -6s; }
        @keyframes ccFloat { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-14px); } }
        .cc-pulse-cta { animation: ccPulse 2s ease-in-out infinite; }
        @keyframes ccPulse { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.05); } }
        .cc-shimmer { position:relative; overflow:hidden; }
        .cc-shimmer::after {
          content:''; position:absolute; top:0; left:-100%; width:60%; height:100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          transform: skewX(-20deg); transition: left 0.7s;
        }
        .cc-shimmer:hover::after { left: 150%; }
        nav a.cc-navlink { position:relative; }
        nav a.cc-navlink::after {
          content:''; position:absolute; bottom:-3px; left:0; right:0; height:2px;
          background: linear-gradient(90deg, #3b82f6, #ec4899);
          transform: scaleX(0); transform-origin: left; transition: transform 0.3s;
        }
        nav a.cc-navlink:hover::after { transform: scaleX(1); }
        .cc-card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .cc-card-hover:hover { transform: translateY(-5px); box-shadow: 0 12px 32px rgba(59,130,246,0.18); }
        .cc-card-hover-pink:hover { box-shadow: 0 12px 32px rgba(236,72,153,0.18); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(#3b82f6,#ec4899); border-radius:3px; }
      `}</style>

      <div className="bg-white text-gray-800 overflow-x-hidden">

        {/* ══════════════ NAVBAR ══════════════ */}
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'}`}>
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="flex items-center justify-between h-16 md:h-20">

              {/* Logo */}
              <a href="#" onClick={e => { e.preventDefault(); window.scrollTo({top:0,behavior:'smooth'}); }} className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform" style={{background:'linear-gradient(135deg,#3b82f6,#60a5fa)'}}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
                  </svg>
                </div>
                <span className="text-lg font-bold text-blue-900">Cloud<span className="cc-gradient-text">Campus</span></span>
              </a>

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-8">
                {[['features','Features'],['roles','Who It\'s For'],['how','How It Works'],['testimonials','Testimonials'],['contact','Contact']].map(([id, label]) => (
                  <a key={id} href={`#${id}`} onClick={e=>{e.preventDefault();scrollTo(id);}} className="cc-navlink text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">{label}</a>
                ))}
              </nav>

              {/* Desktop CTA */}
              <div className="hidden md:flex items-center gap-3">
                <button onClick={goToSchool} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">Sign In</button>
                <button onClick={goToSchool} className="text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200" style={{background:'linear-gradient(135deg,#3b82f6,#60a5fa)'}}>
                  Get Started Free
                </button>
              </div>

              {/* Hamburger */}
              <button className="md:hidden p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu">
                {menuOpen
                  ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                }
              </button>
            </div>

            {/* Mobile menu */}
            <div className={`md:hidden border-t border-gray-100 overflow-hidden transition-all duration-400 ${menuOpen ? 'max-h-96' : 'max-h-0'}`}>
              <div className="py-4 flex flex-col gap-2">
                {[['features','Features'],['roles','Who It\'s For'],['how','How It Works'],['testimonials','Testimonials']].map(([id, label]) => (
                  <a key={id} href={`#${id}`} onClick={e=>{e.preventDefault();scrollTo(id);}} className="py-2 px-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">{label}</a>
                ))}
                <button onClick={goToSchool} className="mt-2 text-white text-sm font-semibold py-3 px-4 rounded-lg text-center shadow-md" style={{background:'linear-gradient(135deg,#3b82f6,#60a5fa)'}}>Get Started Free</button>
              </div>
            </div>
          </div>
        </header>


        {/* ══════════════ HERO ══════════════ */}
        <section className="relative min-h-screen flex items-center overflow-hidden pt-16" style={{background:'linear-gradient(135deg,#1e3a8a 0%,#3b82f6 50%,#60a5fa 100%)'}}>
          <div className="absolute inset-0 cc-hero-grid"></div>

          {/* Blobs */}
          <div className="absolute top-1/4 -left-24 w-72 h-72 cc-blob cc-float" style={{background:'rgba(255,255,255,0.08)'}}></div>
          <div className="absolute bottom-1/4 -right-16 w-56 h-56 cc-blob cc-float-d1" style={{background:'rgba(236,72,153,0.15)'}}></div>
          <div className="absolute top-1/2 left-1/2 w-80 h-80 cc-blob cc-float-d2" style={{background:'rgba(255,255,255,0.04)',transform:'translate(-50%,-50%)'}}></div>
          <div className="absolute top-24 right-1/4 w-3 h-3 rounded-full bg-pink-300 opacity-70 cc-float" style={{animationDelay:'-1s'}}></div>
          <div className="absolute bottom-32 left-1/4 w-4 h-4 rounded-full bg-blue-300 opacity-50 cc-float-d1"></div>

          <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 py-24 w-full">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              {/* Left */}
              <div className="text-white text-center lg:text-left">
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 cc-reveal" style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)'}}>
                  <span className="w-2 h-2 rounded-full bg-pink-300 animate-pulse"></span>
                  <span className="text-xs font-semibold tracking-wide">Now live across Cameroon 🇨🇲</span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 cc-reveal cc-d1" style={{textShadow:'0 4px 20px rgba(0,0,0,0.2)'}}>
                  The Smartest Way to<br/>
                  <span className="text-pink-300">Run Your School</span>
                </h1>

                <p className="text-lg leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0 cc-reveal cc-d2" style={{color:'rgba(255,255,255,0.8)'}}>
                  CloudCampus unites administrators, teachers, vice principals, discipline masters and parents on one powerful platform — built for modern African schools.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start cc-reveal cc-d3">
                  <button onClick={goToSchool} className="cc-pulse-cta bg-white font-bold text-lg px-8 py-4 rounded-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 text-center" style={{color:'#3b82f6'}}>
                    Start Free Today →
                  </button>
                  <button onClick={() => scrollTo('features')} className="font-semibold text-lg px-8 py-4 rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-2 text-white" style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)'}}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    See Features
                  </button>
                </div>

                {/* Micro stats */}
                <div className="flex flex-wrap gap-6 mt-12 justify-center lg:justify-start cc-reveal cc-d4">
                  {[['5+','User Roles'],['6','Sequences'],['100%','Real-time Sync'],['Free','To Start']].map(([v,l]) => (
                    <div key={l} className="text-center">
                      <div className="text-2xl font-extrabold">{v}</div>
                      <div className="text-xs mt-0.5" style={{color:'rgba(255,255,255,0.6)'}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: floating dashboard card */}
              <div className="hidden lg:block cc-reveal cc-d2">
                <div className="cc-float" style={{animationDelay:'-2s'}}>
                  <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <p className="text-xs text-gray-400 font-medium">Admin Dashboard</p>
                        <h3 className="text-gray-800 font-bold text-lg">Good Morning, Principal 👋</h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#3b82f6,#60a5fa)'}}>
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="bg-blue-50 rounded-xl p-3 text-center"><div className="text-blue-600 font-extrabold text-xl">480</div><div className="text-gray-400 text-xs mt-0.5">Students</div></div>
                      <div className="bg-pink-50 rounded-xl p-3 text-center"><div className="text-pink-500 font-extrabold text-xl">36</div><div className="text-gray-400 text-xs mt-0.5">Teachers</div></div>
                      <div className="bg-green-50 rounded-xl p-3 text-center"><div className="text-emerald-600 font-extrabold text-xl">94%</div><div className="text-gray-400 text-xs mt-0.5">Attendance</div></div>
                    </div>
                    {[
                      {icon:'📋',title:'Mr. Nkamla logged Form 4A',sub:'Mathematics · 2 min ago',tag:'Pending',tagColor:'text-amber-700 bg-amber-100'},
                      {icon:'⚠️',title:'Discipline report submitted',sub:'Form 3B · 8 min ago',tag:'New',tagColor:'text-red-600 bg-red-100'},
                      {icon:'✅',title:'Report cards generated',sub:'Sequence 2 · 1 hr ago',tag:'Done',tagColor:'text-green-700 bg-green-100'},
                    ].map((item,i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors cursor-default mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-sm shadow-sm">{item.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{item.title}</p>
                          <p className="text-xs text-gray-400">{item.sub}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.tagColor}`}>{item.tag}</span>
                      </div>
                    ))}
                  </div>

                  {/* Floating badges */}
                  <div className="absolute -top-4 -right-4 text-white rounded-2xl px-4 py-2 shadow-lg text-sm font-semibold flex items-center gap-2" style={{background:'linear-gradient(135deg,#ec4899,#f472b6)'}}>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                    Cloud AI Active
                  </div>
                  <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm">🔔</div>
                    <div><p className="text-xs font-bold text-gray-800">Parent Justification</p><p className="text-xs text-gray-400">Awaiting DM review</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{display:'block'}}>
              <path d="M0 80L60 70C120 60 240 40 360 35C480 30 600 40 720 45C840 50 960 50 1080 43C1200 36 1320 22 1380 15L1440 8V80H0Z" fill="white"/>
            </svg>
          </div>
        </section>


        {/* ══════════════ TRUSTED BY ══════════════ */}
        <section className="py-10 border-y border-gray-100 bg-gray-50">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <p className="text-center text-xs font-semibold tracking-widest text-gray-400 uppercase mb-6 cc-reveal">Designed for Cameroonian schools</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
              {['🏫 Government Secondary Schools','🎓 Technical Colleges','✝️ Mission Schools','🌍 Bilingual Institutions'].map((t,i) => (
                <div key={i} className={`flex items-center gap-2 text-gray-400 font-semibold text-sm cc-reveal cc-d${i}`}>{t}</div>
              ))}
            </div>
          </div>
        </section>


        {/* ══════════════ FEATURES ══════════════ */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="text-center mb-16 cc-reveal">
              <span className="inline-block bg-blue-50 text-blue-600 font-semibold text-xs tracking-widest uppercase px-4 py-1.5 rounded-full mb-4">Core Features</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-4">Everything your school needs,<br className="hidden md:block"/> in one place</h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">From attendance to report cards, CloudCampus handles it all — so your staff can focus on what matters: education.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  delay:'', color:'blue', icon:(
                    <svg className="w-7 h-7 text-blue-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  ),
                  title:'Smart Timetable',
                  desc:'Build weekly schedules visually. The system auto-detects a teacher\'s current class — no manual lookup needed.',
                  tags:['Auto-detection','Per-class views'],
                  iconBg:'bg-blue-50 group-hover:bg-blue-500',
                },
                {
                  delay:'cc-d1', color:'pink', icon:(
                    <svg className="w-7 h-7 text-pink-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  ),
                  title:'E-Logbook',
                  desc:'Teachers log lessons with topics and attendance. Vice Principals review, comment, and track status from Pending to Completed.',
                  tags:['3-stage flow','VP Feedback'],
                  iconBg:'bg-pink-50 group-hover:bg-pink-500',
                },
                {
                  delay:'cc-d2', color:'emerald', icon:(
                    <svg className="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                  ),
                  title:'Marks & Report Cards',
                  desc:'Enter marks per sequence. Auto-generate ranked report cards with averages, grades, and CSV or print export in one click.',
                  tags:['6 Sequences','Auto-rank'],
                  iconBg:'bg-emerald-50 group-hover:bg-emerald-500',
                },
                {
                  delay:'cc-d1', color:'amber', icon:(
                    <svg className="w-7 h-7 text-amber-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  ),
                  title:'Discipline Management',
                  desc:'Issue and track punishments, review attendance registers, and process parent justification requests with full document upload support.',
                  tags:['Punishment log','Justifications'],
                  iconBg:'bg-amber-50 group-hover:bg-amber-500',
                },
                {
                  delay:'cc-d2', color:'violet', icon:(
                    <svg className="w-7 h-7 text-violet-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                  ),
                  title:'Real-time Notifications',
                  desc:'Send targeted alerts to individuals, classes, or the whole school. Parents stay informed about absences, marks, and announcements instantly.',
                  tags:['Targeted sends','Instant push'],
                  iconBg:'bg-violet-50 group-hover:bg-violet-500',
                },
              ].map((f,i) => (
                <div key={i} className={`group bg-white border border-gray-100 rounded-xl p-7 shadow-sm cc-card-hover cc-shimmer cc-reveal ${f.delay}`} style={{borderRadius:'12px',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 ${f.iconBg}`}>{f.icon}</div>
                  <h3 className="font-bold text-xl text-gray-800 mb-2">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                  <div className="mt-5 pt-5 border-t border-gray-100 flex flex-wrap gap-2">
                    {f.tags.map(tag => (
                      <span key={tag} className={`text-xs px-3 py-1 rounded-full font-medium bg-${f.color}-50 text-${f.color}-600`}
                        style={{background:`var(--${f.color}-50,#eff6ff)`,color:`var(--${f.color}-600,#2563eb)`}}>{tag}</span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Cloud AI card — special dark */}
              <div className="group relative rounded-xl p-7 cc-card-hover cc-shimmer cc-reveal cc-d3 overflow-hidden" style={{background:'#1e3a8a',borderRadius:'12px'}}>
                <div className="absolute inset-0 cc-hero-grid opacity-20 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{background:'rgba(255,255,255,0.15)'}}>
                    <svg className="w-7 h-7 text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v3"/></svg>
                  </div>
                  <h3 className="font-bold text-xl text-white mb-2">Cloud AI Assistant</h3>
                  <p className="text-sm leading-relaxed mb-5" style={{color:'rgba(255,255,255,0.7)'}}>Powered by Llama 3.3 — a built-in AI that knows your platform deeply and guides every user through their tasks in real time.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-3 py-1 rounded-full font-medium text-white" style={{background:'rgba(255,255,255,0.15)'}}>Role-aware</span>
                    <span className="text-xs px-3 py-1 rounded-full font-medium text-pink-300" style={{background:'rgba(236,72,153,0.2)'}}>Free · No limits</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ══════════════ ROLES ══════════════ */}
        <section id="roles" className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="text-center mb-16 cc-reveal">
              <span className="inline-block bg-pink-100 text-pink-600 font-semibold text-xs tracking-widest uppercase px-4 py-1.5 rounded-full mb-4">Who It's For</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-4">One platform. Every role.</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">Each stakeholder gets a tailored dashboard — with exactly the tools they need.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
              {[
                {emoji:'🛡️',bg:'linear-gradient(135deg,#3b82f6,#60a5fa)',name:'Administrator',sub:'Full school control',features:['Manage all users & accounts','Build class timetables','Live analytics dashboard','School-wide notifications'],check:'text-blue-500'},
                {emoji:'📐',bg:'linear-gradient(135deg,#ec4899,#f472b6)',name:'Vice Principal',sub:'Class oversight',features:['Review e-logbook entries','Generate report cards','Manage subject attribution','Comment on teacher logs'],check:'text-pink-500'},
                {emoji:'⚖️',bg:'#f59e0b',name:'Discipline Master',sub:'Behavior & attendance',features:['Review attendance registers','Issue punishments','Approve justifications','Track unjustified absences'],check:'text-amber-500'},
              ].map((r,i) => (
                <div key={i} className={`bg-white rounded-xl p-7 cc-card-hover cc-shimmer cc-reveal cc-d${i}`} style={{borderRadius:'12px',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-md hover:scale-110 transition-transform" style={{background:r.bg}}>{r.emoji}</div>
                    <div><h3 className="font-bold text-gray-800">{r.name}</h3><p className="text-xs text-gray-400">{r.sub}</p></div>
                  </div>
                  <ul className="space-y-2.5 text-sm text-gray-500">
                    {r.features.map(f => (
                      <li key={f} className="flex items-center gap-2">
                        <svg className={`w-4 h-4 flex-shrink-0 ${r.check}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Teacher — wider */}
              <div className="bg-white rounded-xl p-7 cc-card-hover cc-shimmer cc-reveal" style={{borderRadius:'12px',boxShadow:'0 4px 12px rgba(0,0,0,0.08)',background:'linear-gradient(135deg,#eff6ff,#ffffff)'}}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center text-xl shadow-md hover:scale-110 transition-transform">📖</div>
                  <div><h3 className="font-bold text-gray-800 text-lg">Teacher</h3><p className="text-xs text-gray-400">Day-to-day classroom management</p></div>
                </div>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">The most feature-rich role. Smart class detector, one-screen attendance + logbook, full marks entry and document publishing.</p>
                <div className="grid grid-cols-2 gap-2">
                  {['📍 Auto class detection','✍️ E-logbook entry','📊 Marks — 6 sequences','📁 Publish documents'].map(tag => (
                    <span key={tag} className="text-xs bg-white border border-blue-100 text-blue-600 px-3 py-1.5 rounded-lg font-medium text-center shadow-sm">{tag}</span>
                  ))}
                </div>
              </div>

              {/* Parent */}
              <div className="bg-white rounded-xl p-7 cc-card-hover cc-reveal cc-d2" style={{borderRadius:'12px',boxShadow:'0 4px 12px rgba(0,0,0,0.08)',background:'linear-gradient(135deg,#fdf2f8,#ffffff)'}}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-xl shadow-md hover:scale-110 transition-transform">👨‍👩‍👧</div>
                  <div><h3 className="font-bold text-gray-800">Parent</h3><p className="text-xs text-gray-400">Child monitoring</p></div>
                </div>
                <ul className="space-y-2.5 text-sm text-gray-500">
                  {['View absences & punishments','Submit justifications with files','Access class documents','School library & notifications'].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>


        {/* ══════════════ HOW IT WORKS ══════════════ */}
        <section id="how" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="text-center mb-16 cc-reveal">
              <span className="inline-block bg-blue-50 text-blue-600 font-semibold text-xs tracking-widest uppercase px-4 py-1.5 rounded-full mb-4">The Process</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-4">From setup to running<br/>in under 10 minutes</h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">No IT department needed. No complicated config. Just three simple steps.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {[
                {num:'1',bg:'linear-gradient(135deg,#3b82f6,#60a5fa)',emoji:'🏫',title:'Admin Sets Up the School',desc:'Create your school account, add users, define classes & subjects, assign staff, and build the timetable — all in one go.',delay:''},
                {num:'2',bg:'linear-gradient(135deg,#ec4899,#f472b6)',emoji:'📡',title:'Everyone Gets Their Dashboard',desc:'Each user logs in and sees their tailored workspace — teachers their classes, VPs their logbook, parents their child\'s progress.',delay:'cc-d1'},
                {num:'3',bg:'#10b981',emoji:'⚡',title:'School Runs Itself',desc:'Lessons logged, marks entered, absences tracked, parents notified, report cards generated — zero paperwork, fully automated.',delay:'cc-d2'},
              ].map((s,i) => (
                <div key={i} className={`text-center cc-reveal ${s.delay} group`}>
                  <div className="relative inline-flex mb-6">
                    <div className="w-14 h-14 rounded-2xl text-white flex items-center justify-center text-2xl font-extrabold shadow-lg group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 relative z-10" style={{background:s.bg}}>{s.num}</div>
                    <div className="absolute inset-0 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" style={{background:s.bg}}></div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-8 cc-card-hover" style={{borderRadius:'12px',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
                    <div className="text-3xl mb-4">{s.emoji}</div>
                    <h3 className="font-bold text-xl text-gray-800 mb-3">{s.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ══════════════ TESTIMONIALS ══════════════ */}
        <section id="testimonials" className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="text-center mb-16 cc-reveal">
              <span className="inline-block bg-pink-100 text-pink-600 font-semibold text-xs tracking-widest uppercase px-4 py-1.5 rounded-full mb-4">Testimonials</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-4">Loved by schools across Cameroon</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-7 cc-card-hover cc-shimmer cc-reveal" style={{borderRadius:'12px',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
                <div className="text-amber-400 text-lg mb-4">★★★★★</div>
                <p className="text-gray-500 text-sm leading-relaxed mb-6 italic">"The timetable auto-detection is a game changer. I open the app and it already knows which class I'm teaching. Tap absent students, submit — done in 30 seconds."</p>
                <div className="flex items-center gap-3 pt-5 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{background:'linear-gradient(135deg,#3b82f6,#60a5fa)'}}>JN</div>
                  <div><p className="text-sm font-semibold text-gray-800">Jean Nkamla</p><p className="text-xs text-gray-400">Maths Teacher — GHS Yaoundé</p></div>
                </div>
              </div>

              <div className="rounded-xl p-7 cc-card-hover cc-reveal cc-d1 relative overflow-hidden" style={{background:'#1e3a8a',borderRadius:'12px'}}>
                <div className="absolute inset-0 cc-hero-grid opacity-20 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="text-amber-400 text-lg mb-4">★★★★★</div>
                  <p className="text-sm leading-relaxed mb-6 italic" style={{color:'rgba(255,255,255,0.8)'}}>
                    "Before CloudCampus, generating report cards took 3 days. Now I select the sequences, hit generate, and the ranked list is ready in seconds."</p>
                  <div className="flex items-center gap-3 pt-5 border-t" style={{borderColor:'rgba(255,255,255,0.15)'}}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{background:'linear-gradient(135deg,#ec4899,#f472b6)'}}>AT</div>
                    <div><p className="text-sm font-semibold text-white">Aminatou Tchoufa</p><p className="text-xs" style={{color:'rgba(255,255,255,0.6)'}}>Vice Principal — Collège Saint-Paul</p></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-7 cc-card-hover cc-shimmer cc-reveal cc-d2" style={{borderRadius:'12px',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
                <div className="text-amber-400 text-lg mb-4">★★★★★</div>
                <p className="text-gray-500 text-sm leading-relaxed mb-6 italic">"As a parent, I used to have no idea what was happening at school. Now I get notified when my child is absent, and I can upload justification documents from my phone."</p>
                <div className="flex items-center gap-3 pt-5 border-t border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">PM</div>
                  <div><p className="text-sm font-semibold text-gray-800">Paul Mbarga</p><p className="text-xs text-gray-400">Parent — Lycée Bilingue de Bafoussam</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ══════════════ BENEFITS ══════════════ */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-5 md:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="cc-reveal">
                <span className="inline-block bg-blue-50 text-blue-600 font-semibold text-xs tracking-widest uppercase px-4 py-1.5 rounded-full mb-4">Why CloudCampus</span>
                <h2 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-8 leading-tight">Built for the realities of<br/>African education</h2>
                <div className="space-y-6">
                  {[
                    {bg:'bg-blue-50 group-hover:bg-blue-500',icon:<svg className="w-5 h-5 text-blue-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2a2 2 0 002 2zM12 3a9 9 0 110 18 9 9 0 010-18z"/></svg>,title:'Works on any device',desc:'Web browser, mobile phone, or Android APK — CloudCampus adapts to whatever device your school has.'},
                    {bg:'bg-pink-50 group-hover:bg-pink-500',icon:<svg className="w-5 h-5 text-pink-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>,title:'Bilingual — English & French',desc:'Full English and French support built in. Designed specifically for Cameroon\'s bilingual educational system.'},
                    {bg:'bg-emerald-50 group-hover:bg-emerald-500',icon:<svg className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,title:'Secure & private by design',desc:'Every school\'s data is completely isolated. Sessions persist for 5 days — no constant re-logins on the APK.'},
                    {bg:'bg-violet-50 group-hover:bg-violet-500',icon:<svg className="w-5 h-5 text-violet-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,title:'Instant setup, zero IT needed',desc:'No servers, no installation. The admin creates the school and the whole platform is ready in minutes.'},
                  ].map((b,i) => (
                    <div key={i} className="flex gap-4 group">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${b.bg}`}>{b.icon}</div>
                      <div><h4 className="font-semibold text-gray-800 mb-1">{b.title}</h4><p className="text-gray-500 text-sm leading-relaxed">{b.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-4 cc-reveal cc-d1">
                <div className="rounded-2xl p-6 border cc-card-hover" style={{background:'linear-gradient(135deg,#eff6ff,#dbeafe)',borderColor:'#bfdbfe'}}>
                  <div className="text-4xl font-extrabold cc-gradient-text-blue mb-1"><span className="cc-count" data-target="5">0</span></div>
                  <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Connected Roles</div>
                </div>
                <div className="rounded-2xl p-6 border cc-card-hover" style={{background:'linear-gradient(135deg,#fdf2f8,#fce7f3)',borderColor:'#fbcfe8'}}>
                  <div className="text-4xl font-extrabold text-pink-500 mb-1"><span className="cc-count" data-target="6">0</span></div>
                  <div className="text-xs font-medium text-pink-500 uppercase tracking-wide">Grade Sequences</div>
                </div>
                <div className="col-span-2 rounded-2xl p-7 cc-card-hover relative overflow-hidden" style={{background:'linear-gradient(135deg,#1e3a8a,#3b82f6)'}}>
                  <div className="absolute inset-0 cc-hero-grid opacity-20 pointer-events-none"></div>
                  <div className="relative z-10">
                    <div className="text-5xl font-extrabold text-white mb-2">100%</div>
                    <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:'rgba(255,255,255,0.7)'}}>Free to Get Started</div>
                    <p className="text-sm" style={{color:'rgba(255,255,255,0.8)'}}>No credit card. No hidden fees. Start managing your school today at zero cost.</p>
                  </div>
                </div>
                <div className="rounded-2xl p-6 border cc-card-hover" style={{background:'linear-gradient(135deg,#ecfdf5,#d1fae5)',borderColor:'#a7f3d0'}}>
                  <div className="text-4xl font-extrabold text-emerald-600 mb-1">∞</div>
                  <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Schools Supported</div>
                </div>
                <div className="rounded-2xl p-6 border cc-card-hover" style={{background:'linear-gradient(135deg,#fffbeb,#fef3c7)',borderColor:'#fde68a'}}>
                  <div className="text-4xl font-extrabold text-amber-600 mb-1"><span className="cc-count" data-target="2">0</span></div>
                  <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">Languages</div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* ══════════════ CTA ══════════════ */}
        <section className="py-24 relative overflow-hidden" style={{background:'linear-gradient(135deg,#eff6ff,#ffffff,#fdf2f8)'}}>
          <div className="absolute top-0 left-0 w-72 h-72 cc-blob opacity-30" style={{background:'rgba(59,130,246,0.1)',transform:'translate(-50%,-50%)'}}></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 cc-blob opacity-20" style={{background:'rgba(236,72,153,0.1)',transform:'translate(50%,50%)'}}></div>

          <div className="relative z-10 max-w-4xl mx-auto px-5 md:px-8 text-center cc-reveal">
            <span className="inline-block bg-blue-100 text-blue-600 font-semibold text-xs tracking-widest uppercase px-4 py-1.5 rounded-full mb-6">Ready to transform your school?</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-blue-900 mb-5 leading-tight">
              Join CloudCampus today.<br/><span className="cc-gradient-text">It's completely free.</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed mb-10">
              No credit card. No complicated setup. Works on web, mobile and Android APK. Available in English and French. Your school up and running in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={goToSchool} className="cc-pulse-cta inline-flex items-center justify-center gap-2 text-white font-bold text-lg px-10 py-5 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-200" style={{background:'linear-gradient(135deg,#3b82f6,#60a5fa)'}}>
                Get Started Free →
              </button>
              <button onClick={goToSchool} className="inline-flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-800 font-semibold text-lg px-10 py-5 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all duration-200">
                Sign In
              </button>
            </div>
            {/* Social proof */}
            <div className="mt-10 flex flex-wrap justify-center items-center gap-6 text-sm text-gray-400">
              {['No credit card required','Setup in under 10 minutes','English & French supported','Works on all devices'].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>



        {/* ══════════════ CONTACT ══════════════ */}
        <section id="contact" className="py-24 bg-white">
          <div className="max-w-5xl mx-auto px-5 md:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-start">

              {/* Left — info */}
              <div className="cc-reveal">
                <span className="inline-block bg-blue-50 text-blue-600 font-semibold text-xs tracking-widest uppercase px-4 py-1.5 rounded-full mb-5">Get in touch</span>
                <h2 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-5 leading-tight">
                  We'd love to<br/>hear from you
                </h2>
                <p className="text-gray-500 text-lg leading-relaxed mb-8">
                  Whether you're a school director, parent, or teacher — reach out and we'll get back to you within 24 hours.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: '✉️', label: 'Email', value: 'cloudcampus001@gmail.com' },
                    { icon: '📍', label: 'Location', value: 'Yaoundé, Cameroon 🇨🇲' },
                    { icon: '🕐', label: 'Response time', value: 'Within 24 hours' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">{item.label}</p>
                        <p className="text-sm font-semibold text-blue-900">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — form */}
              <div className="cc-reveal cc-d1">
                <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm" style={{boxShadow:'0 4px 24px rgba(59,130,246,0.08)'}}>
                  {contactSent ? (
                    <div className="text-center py-10">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">Message sent!</h3>
                      <p className="text-gray-500 text-sm">We'll reply to your email within 24 hours.</p>
                      <button
                        onClick={() => setContactSent(false)}
                        className="mt-6 text-blue-600 text-sm font-semibold hover:underline"
                      >Send another message</button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <h3 className="text-lg font-bold text-gray-800">Send us a message</h3>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Your name</label>
                        <input
                          type="text" required
                          value={contactForm.name}
                          onChange={e => setContactForm(p => ({...p, name: e.target.value}))}
                          placeholder="e.g. Jean Nkamla"
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Email address</label>
                        <input
                          type="email" required
                          value={contactForm.email}
                          onChange={e => setContactForm(p => ({...p, email: e.target.value}))}
                          placeholder="you@school.cm"
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Message</label>
                        <textarea
                          required rows={5}
                          value={contactForm.message}
                          onChange={e => setContactForm(p => ({...p, message: e.target.value}))}
                          placeholder="How can we help your school?"
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all resize-none"
                        />
                      </div>

                      {contactError && (
                        <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2">{contactError}</p>
                      )}

                      <button
                        onClick={handleContactSubmit}
                        disabled={contactSending || !contactForm.name || !contactForm.email || !contactForm.message}
                        className="w-full text-white font-bold py-3.5 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                        style={{background:'linear-gradient(135deg,#3b82f6,#60a5fa)'}}
                      >
                        {contactSending ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Sending…
                          </>
                        ) : 'Send Message →'}
                      </button>

                      <p className="text-center text-xs text-gray-400">We'll reply within 24 hours to {contactForm.email || 'your email'}.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </section>


        {/* ══════════════ FOOTER ══════════════ */}
        <footer className="text-white" style={{background:'#1e3a8a'}}>
          <div className="max-w-7xl mx-auto px-5 md:px-8 pt-16 pb-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'rgba(255,255,255,0.15)'}}>
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
                  </div>
                  <span className="text-lg font-bold">CloudCampus</span>
                </div>
                <p className="text-sm leading-relaxed max-w-sm mb-6" style={{color:'rgba(255,255,255,0.6)'}}>The smarter, modern way to manage schools in Africa. Connecting every stakeholder in one powerful platform.</p>
              </div>
              <div>
                <h4 className="font-semibold text-xs uppercase tracking-widest mb-5" style={{color:'rgba(255,255,255,0.5)'}}>Product</h4>
                <ul className="space-y-3">
                  {[['#features','Features'],['#roles','Who It\'s For'],['#how','How It Works'],['#','Cloud AI'],['#','Mobile App']].map(([href,label]) => (
                    <li key={label}><a href={href} onClick={e=>{e.preventDefault();href!=='#'&&scrollTo(href.slice(1));}} className="text-sm transition-colors hover:translate-x-1 inline-block" style={{color:'rgba(255,255,255,0.7)'}}>{label}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-xs uppercase tracking-widest mb-5" style={{color:'rgba(255,255,255,0.5)'}}>Contact</h4>
                <ul className="space-y-3 text-sm" style={{color:'rgba(255,255,255,0.7)'}}>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-pink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>cloudcampus001@gmail.com</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-pink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>Yaoundé, Cameroon 🇨🇲</li>
                  <li className="flex items-center gap-2"><svg className="w-4 h-4 text-pink-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>EN · FR</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{borderColor:'rgba(255,255,255,0.1)'}}>
              <p className="text-sm" style={{color:'rgba(255,255,255,0.4)'}}>© 2025 CloudCampus. All rights reserved.</p>
              <div className="flex gap-6 text-sm">
                {[['Privacy','#'],['Terms','#'],['Contact','#contact']].map(([l,href]) => (
                  <a key={l} href={href} onClick={e=>{e.preventDefault();href!=='#'&&scrollTo(href.slice(1));}} className="transition-colors" style={{color:'rgba(255,255,255,0.4)'}}>{l}</a>
                ))}
              </div>
            </div>
          </div>
        </footer>

        {/* Back to top */}
        <button
          onClick={() => window.scrollTo({top:0,behavior:'smooth'})}
          className={`fixed bottom-6 right-6 w-11 h-11 rounded-xl shadow-lg flex items-center justify-center text-white hover:scale-110 transition-all z-50 ${showBtt ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}
          style={{background:'linear-gradient(135deg,#3b82f6,#60a5fa)'}}
          aria-label="Back to top"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7"/></svg>
        </button>

      </div>
    </>
  );
};

export default LandingPage;