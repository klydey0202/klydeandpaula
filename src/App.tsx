/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { 
  Heart, MapPin, Calendar, Clock, Camera, User, 
  Settings, LogOut, Send, CheckCircle, QrCode, 
  Scan, Image as ImageIcon, Trash2, Edit3, 
  ChevronRight, ChevronLeft, X, Menu, 
  Music, Gift, Info, Users, Car
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDropzone } from 'react-dropzone';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface WeddingContent {
  coupleNames: string;
  weddingDate: string;
  hashtag: string;
  heroTitle: string;
  heroSubtitle: string;
  ceremonyVenue: string;
  ceremonyAddress: string;
  ceremonyTime: string;
  receptionVenue: string;
  receptionAddress: string;
  receptionTime: string;
  parkingNote: string;
  attireText: string;
  giftText: string;
  adminPassword: string;
}

interface RSVP {
  id: string;
  name: string;
  contact: string;
  attending: boolean;
  mealPreference: string;
  guestCount: number;
  timestamp: number;
  seatNumber?: string;
}

interface FeedPost {
  id: string;
  name: string;
  message: string;
  photo?: string;
  timestamp: number;
}

interface CheckIn {
  id: string;
  rsvpId: string;
  photo?: string;
  timestamp: number;
}

// --- Constants ---
const DEFAULT_CONTENT: WeddingContent = {
  coupleNames: "Klyde & Paula",
  weddingDate: "November 20, 2026",
  hashtag: "#KlydeAndPaula2026",
  heroTitle: "The Beginning of Forever",
  heroSubtitle: "We're getting married!",
  ceremonyVenue: "Iglesia Ni Cristo, Lokal ng San Francisco",
  ceremonyAddress: "#1039 Del Monte Ave, San Francisco del Monte, Quezon City",
  ceremonyTime: "2:00 PM",
  receptionVenue: "Stalla Suites Event Place",
  receptionAddress: "1008 Quezon Ave, Paligsahan, Diliman, Quezon City",
  receptionTime: "4:00 PM",
  parkingNote: "First 50 vehicles, first come first serve.",
  attireText: "We'd love to see you in our warm motif! Think rusty oranges, terracotta, and earthy tones.",
  giftText: "We're so excited to celebrate with you! While your presence is the only gift we need, if you're feeling extra generous, a contribution to our 'New Home & Travel' fund would be absolutely amazing. We've already got enough toasters to open a bakery!",
  adminPassword: "klydeandpaula2026",
};

const PRENUP_IMAGES = [
  "https://picsum.photos/seed/wedding1/800/1200",
  "https://picsum.photos/seed/wedding2/1200/800",
  "https://picsum.photos/seed/wedding3/800/800",
  "https://picsum.photos/seed/wedding4/1200/1200",
  "https://picsum.photos/seed/wedding5/800/1000",
  "https://picsum.photos/seed/wedding6/1000/800",
];

// --- Main App ---
export default function App() {
  // --- State ---
  const [content, setContent] = useState<WeddingContent>(DEFAULT_CONTENT);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'gallery' | 'details' | 'rsvp' | 'feed' | 'admin' | 'scanner'>('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- Real-time Sync ---
  useEffect(() => {
    // Fetch initial data
    const fetchData = async () => {
      try {
        const [contentRes, rsvpsRes, postsRes, checkinsRes] = await Promise.all([
          fetch('/api/content'),
          fetch('/api/rsvps'),
          fetch('/api/posts'),
          fetch('/api/checkins')
        ]);
        
        if (contentRes.ok) setContent(await contentRes.json());
        if (rsvpsRes.ok) setRsvps(await rsvpsRes.json());
        if (postsRes.ok) setPosts(await postsRes.json());
        if (checkinsRes.ok) setCheckIns(await checkinsRes.json());
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    };

    fetchData();

    // WebSocket setup
    // const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // const wsUrl = `${protocol}//${window.location.host}`;
    // const ws = new WebSocket(wsUrl);
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case 'content_update':
          setContent(message.data);
          break;
        case 'rsvp_new':
          setRsvps(prev => {
            if (prev.find(r => r.id === message.data.id)) return prev;
            return [message.data, ...prev];
          });
          break;
        case 'rsvp_update':
          setRsvps(prev => prev.map(r => r.id === message.data.id ? message.data : r));
          break;
        case 'rsvp_delete':
          setRsvps(prev => prev.filter(r => r.id !== message.id));
          break;
        case 'post_new':
          setPosts(prev => {
            if (prev.find(p => p.id === message.data.id)) return prev;
            return [message.data, ...prev];
          });
          break;
        case 'checkin_new':
          setCheckIns(prev => {
            if (prev.find(c => c.id === message.data.id)) return prev;
            return [message.data, ...prev];
          });
          break;
      }
    };

    return () => ws.close();
  }, []);

  // --- Handlers ---
  const handleRSVP = async (newRSVP: Omit<RSVP, 'id' | 'timestamp'>) => {
    const rsvp: RSVP = {
      ...newRSVP,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    try {
      await fetch('/api/rsvps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rsvp)
      });
    } catch (err) {
      console.error("Failed to send RSVP", err);
    }
    return rsvp;
  };

  const handlePost = async (newPost: Omit<FeedPost, 'id' | 'timestamp'>) => {
    const post: FeedPost = {
      ...newPost,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
      });
    } catch (err) {
      console.error("Failed to send post", err);
    }
  };

  const handleCheckIn = async (rsvpId: string, photo?: string) => {
    const checkIn: CheckIn = {
      id: crypto.randomUUID(),
      rsvpId,
      photo,
      timestamp: Date.now(),
    };
    try {
      await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkIn)
      });
      
      if (photo) {
        const rsvp = rsvps.find(r => r.id === rsvpId);
        handlePost({
          name: rsvp?.name || "Guest",
          message: "Just checked in! 🥂",
          photo,
        });
      }
    } catch (err) {
      console.error("Failed to check in", err);
    }
  };

// --- Components ---
const Section = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <motion.section
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
    className={className}
  >
    {children}
  </motion.section>
);

const Navigation = () => (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <button 
          onClick={() => setActiveTab('home')}
          className="text-2xl font-serif font-bold text-stone-800 tracking-tighter"
        >
          K<span className="text-terracotta-700">&</span>P
        </button>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600 uppercase tracking-widest">
          {[
            { id: 'home', label: 'Home' },
            { id: 'gallery', label: 'Gallery' },
            { id: 'details', label: 'Details' },
            { id: 'rsvp', label: 'RSVP' },
            { id: 'feed', label: 'Feed' },
            { id: 'scanner', label: 'Scan' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "hover:text-terracotta-700 transition-colors",
                activeTab === item.id && "text-terracotta-700 font-bold"
              )}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('admin')}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Nav Toggle */}
        <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white border-b border-stone-200 p-4 flex flex-col gap-4"
          >
            {[
              { id: 'home', label: 'Home' },
              { id: 'gallery', label: 'Gallery' },
              { id: 'details', label: 'Details' },
              { id: 'rsvp', label: 'RSVP' },
              { id: 'feed', label: 'Feed' },
              { id: 'scanner', label: 'Scan' },
              { id: 'admin', label: 'Admin' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setIsMenuOpen(false);
                }}
                className={cn(
                  "text-left py-2 text-stone-600 uppercase tracking-widest text-sm",
                  activeTab === item.id && "text-terracotta-700 font-bold"
                )}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-terracotta-200 selection:text-terracotta-900">
      <Navigation />
      
      <main className="pt-16">
        {activeTab === 'home' && <HomeSection content={content} setActiveTab={setActiveTab} />}
        {activeTab === 'gallery' && <Section><GallerySection /></Section>}
        {activeTab === 'details' && <Section><DetailsSection content={content} /></Section>}
        {activeTab === 'rsvp' && <Section><RSVPSection onRSVP={handleRSVP} /></Section>}
        {activeTab === 'feed' && <Section><FeedSection posts={posts} onPost={handlePost} hashtag={content.hashtag} /></Section>}
        {activeTab === 'scanner' && <Section><ScannerSection rsvps={rsvps} onCheckIn={handleCheckIn} onCapture={handlePost} /></Section>}
        {activeTab === 'admin' && (
          <Section>
            <AdminSection 
              content={content} 
              setContent={setContent} 
              rsvps={rsvps} 
              setRsvps={setRsvps}
              isAdmin={isAdmin} 
              setIsAdmin={setIsAdmin} 
            />
          </Section>
        )}
      </main>

      <footer className="py-12 bg-stone-900 text-stone-400 text-center text-sm">
        <p className="font-serif italic text-stone-200 mb-2">Made with love for {content.coupleNames}</p>
        <p>© 2026 {content.hashtag}</p>
      </footer>
    </div>
  );
}

// --- Sub-Sections ---

function HomeSection({ content, setActiveTab }: { content: WeddingContent, setActiveTab: any }) {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <motion.div 
          style={{ y: y1 }}
          className="absolute inset-0 z-0"
        >
          <img 
            src="https://picsum.photos/seed/wedding-hero/1920/1080" 
            alt="Hero" 
            className="w-full h-full object-cover brightness-50"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        
        <motion.div 
          style={{ opacity }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative z-10 text-center px-4"
        >
          <span className="text-terracotta-200 uppercase tracking-[0.3em] text-sm mb-4 block">Save the Date</span>
          <h1 className="text-6xl md:text-8xl font-serif text-white mb-6 tracking-tighter">
            {content.coupleNames}
          </h1>
          <p className="text-xl md:text-2xl text-stone-200 font-light italic mb-8">
            {content.weddingDate}
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button 
              onClick={() => setActiveTab('rsvp')}
              className="px-8 py-3 bg-terracotta-700 text-white rounded-full hover:bg-terracotta-800 transition-all transform hover:scale-105 shadow-lg shadow-terracotta-900/20"
            >
              RSVP Now
            </button>
            <button 
              onClick={() => setActiveTab('details')}
              className="px-8 py-3 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-full hover:bg-white/20 transition-all"
            >
              View Details
            </button>
          </div>
        </motion.div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce text-white/50">
          <ChevronRight className="rotate-90" />
        </div>
      </section>

      {/* Intro */}
      <section className="py-24 px-4 max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="space-y-8"
        >
          <Heart className="w-12 h-12 text-terracotta-700 mx-auto" />
          <h2 className="text-4xl font-serif text-stone-800">{content.heroTitle}</h2>
          <p className="text-lg text-stone-600 leading-relaxed font-light italic">
            "{content.heroSubtitle}"
          </p>
          <div className="h-px w-24 bg-stone-200 mx-auto" />
        </motion.div>
      </section>

      {/* Attire Section */}
      <section className="py-24 bg-stone-100">
        <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <h3 className="text-3xl font-serif text-stone-800 mb-6">Attire Suggestion</h3>
            <p className="text-stone-600 mb-8 leading-relaxed">
              {content.attireText}
            </p>
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-[#9C4A3D] shadow-inner" />
              <div className="w-12 h-12 rounded-full bg-[#C06C5D] shadow-inner" />
              <div className="w-12 h-12 rounded-full bg-[#E59866] shadow-inner" />
              <div className="w-12 h-12 rounded-full bg-[#F5CBA7] shadow-inner" />
            </div>
          </div>
          <div className="order-1 md:order-2 grid grid-cols-2 gap-4">
            <img src="https://picsum.photos/seed/attire1/400/600" className="rounded-2xl shadow-lg" referrerPolicy="no-referrer" />
            <img src="https://picsum.photos/seed/attire2/400/600" className="rounded-2xl shadow-lg mt-8" referrerPolicy="no-referrer" />
          </div>
        </div>
      </section>

      {/* Gift Section */}
      <section className="py-24 px-4 text-center bg-white">
        <div className="max-w-2xl mx-auto space-y-8">
          <Gift className="w-12 h-12 text-terracotta-700 mx-auto" />
          <h3 className="text-3xl font-serif text-stone-800">Gift Suggestions</h3>
          <p className="text-stone-600 italic leading-relaxed">
            {content.giftText}
          </p>
          <p className="text-sm text-stone-400 uppercase tracking-widest">
            (But seriously, your presence is enough!)
          </p>
        </div>
      </section>
    </div>
  );
}

function GallerySection() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <section className="py-24 px-4 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-5xl font-serif text-stone-800 mb-4">Prenup Gallery</h2>
        <p className="text-stone-500 uppercase tracking-widest text-sm">Capturing our moments</p>
      </div>

      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
        {PRENUP_IMAGES.map((src, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            viewport={{ once: true }}
            className="relative group cursor-pointer overflow-hidden rounded-2xl"
            onClick={() => setSelectedImage(src)}
          >
            <img 
              src={src} 
              alt={`Gallery ${i}`} 
              className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-terracotta-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="text-white w-8 h-8" />
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <button className="absolute top-8 right-8 text-white">
              <X className="w-8 h-8" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={selectedImage}
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function DetailsSection({ content }: { content: WeddingContent }) {
  return (
    <section className="py-24 px-4 max-w-7xl mx-auto space-y-24">
      <div className="text-center">
        <h2 className="text-5xl font-serif text-stone-800 mb-4">When & Where</h2>
        <p className="text-stone-500 uppercase tracking-widest text-sm">The big day details</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-16">
        {/* Ceremony */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <div className="flex items-center gap-4 text-terracotta-700">
            <div className="p-3 bg-terracotta-50 rounded-2xl">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-serif text-stone-800">Ceremony</h3>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-4">
            <p className="text-xl font-medium text-stone-800">{content.ceremonyVenue}</p>
            <p className="text-stone-500">{content.ceremonyAddress}</p>
            <div className="flex items-center gap-2 text-terracotta-700 font-medium">
              <Clock className="w-4 h-4" />
              <span>{content.ceremonyTime}</span>
            </div>
            <div className="h-[300px] rounded-2xl overflow-hidden bg-stone-100">
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight={0} 
                marginWidth={0} 
                src="https://maps.google.com/maps?q=Iglesia%20Ni%20Cristo%20Lokal%20ng%20San%20Francisco%20Quezon%20City&t=&z=15&ie=UTF8&iwloc=&output=embed"
              />
            </div>
          </div>
        </motion.div>

        {/* Reception */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <div className="flex items-center gap-4 text-terracotta-700">
            <div className="p-3 bg-terracotta-50 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-serif text-stone-800">Reception</h3>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-4">
            <p className="text-xl font-medium text-stone-800">{content.receptionVenue}</p>
            <p className="text-stone-500">{content.receptionAddress}</p>
            <div className="flex items-center gap-2 text-terracotta-700 font-medium">
              <Clock className="w-4 h-4" />
              <span>{content.receptionTime}</span>
            </div>
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 flex items-start gap-3">
              <Car className="w-5 h-5 text-stone-400 mt-1" />
              <p className="text-sm text-stone-600">
                <span className="font-bold">Parking Note:</span> {content.parkingNote}
              </p>
            </div>
            <div className="h-[300px] rounded-2xl overflow-hidden bg-stone-100">
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight={0} 
                marginWidth={0} 
                src="https://maps.google.com/maps?q=Stalla%20Suites%20Event%20Place%20Quezon%20City&t=&z=15&ie=UTF8&iwloc=&output=embed"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function RSVPSection({ onRSVP }: { onRSVP: (rsvp: any) => Promise<RSVP> }) {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    attending: 'yes',
    mealPreference: 'Standard',
    guestCount: 1,
  });
  const [submitted, setSubmitted] = useState<RSVP | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rsvp = await onRSVP({
      ...formData,
      attending: formData.attending === 'yes',
    });
    setSubmitted(rsvp);
  };

  if (submitted) {
    return (
      <section className="py-24 px-4 max-w-xl mx-auto text-center space-y-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-3xl shadow-xl border border-stone-100 space-y-6"
        >
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-serif text-stone-800">Thank You, {submitted.name}!</h2>
          <p className="text-stone-600">Your RSVP has been received. We can't wait to see you!</p>
          
          <div className="p-6 bg-stone-50 rounded-2xl space-y-4">
            <p className="text-sm text-stone-400 uppercase tracking-widest">Your Entry Pass</p>
            <div className="flex justify-center">
              <QRCodeSVG value={submitted.id} size={150} />
            </div>
            <p className="text-xs text-stone-400">Please save this QR code for check-in at the venue.</p>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="text-terracotta-700 font-medium hover:underline"
          >
            Print Entry Pass
          </button>
        </motion.div>
      </section>
    );
  }

  return (
    <section className="py-24 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-5xl font-serif text-stone-800 mb-4">RSVP</h2>
        <p className="text-stone-500 uppercase tracking-widest text-sm">Kindly respond by October 20, 2026</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-stone-100 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-stone-700">Full Name</label>
          <input 
            required
            type="text" 
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-terracotta-500 outline-none transition-all"
            placeholder="John Doe"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-stone-700">Contact Number</label>
          <input 
            required
            type="tel" 
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-terracotta-500 outline-none transition-all"
            placeholder="0917 123 4567"
            value={formData.contact}
            onChange={e => setFormData({...formData, contact: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Will you attend?</label>
            <select 
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-terracotta-500 outline-none transition-all"
              value={formData.attending}
              onChange={e => setFormData({...formData, attending: e.target.value})}
            >
              <option value="yes">Yes, I'll be there!</option>
              <option value="no">Regretfully, no.</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">Number of Guests</label>
            <input 
              type="number" 
              min="1" 
              max="5"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-terracotta-500 outline-none transition-all"
              value={formData.guestCount}
              onChange={e => setFormData({...formData, guestCount: parseInt(e.target.value)})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-stone-700">Meal Preference</label>
          <select 
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-terracotta-500 outline-none transition-all"
            value={formData.mealPreference}
            onChange={e => setFormData({...formData, mealPreference: e.target.value})}
          >
            <option value="Standard">Standard</option>
            <option value="Vegetarian">Vegetarian</option>
            <option value="No Pork">No Pork</option>
            <option value="Kids Meal">Kids Meal</option>
          </select>
        </div>

        <button 
          type="submit"
          className="w-full py-4 bg-terracotta-700 text-white rounded-xl font-bold hover:bg-terracotta-800 transition-all shadow-lg shadow-terracotta-900/20"
        >
          Submit RSVP
        </button>
      </form>
    </section>
  );
}

function FeedSection({ posts, onPost, hashtag }: { posts: FeedPost[], onPost: (post: any) => Promise<void>, hashtag: string }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] },
    multiple: false 
  } as any);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !message) return;
    await onPost({ name, message, photo: photo || undefined });
    setName('');
    setMessage('');
    setPhoto(null);
  };

  return (
    <section className="py-24 px-4 max-w-3xl mx-auto space-y-12">
      <div className="text-center">
        <h2 className="text-5xl font-serif text-stone-800 mb-4">Activity Feed</h2>
        <p className="text-stone-500 uppercase tracking-widest text-sm">Share your moments with {hashtag}</p>
      </div>

      {/* Post Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-terracotta-100 text-terracotta-700 rounded-full flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <input 
            required
            type="text" 
            placeholder="Your Name"
            className="flex-1 bg-stone-50 px-4 py-2 rounded-full outline-none focus:ring-1 focus:ring-terracotta-500"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <textarea 
          required
          placeholder="Write something..."
          className="w-full bg-stone-50 p-4 rounded-2xl outline-none focus:ring-1 focus:ring-terracotta-500 min-h-[100px] resize-none"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        
        {photo && (
          <div className="relative w-32 h-32 rounded-xl overflow-hidden">
            <img src={photo} className="w-full h-full object-cover" />
            <button 
              type="button"
              onClick={() => setPhoto(null)}
              className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div {...getRootProps()} className="cursor-pointer text-stone-400 hover:text-terracotta-700 transition-colors">
            <input {...getInputProps()} />
            <div className="flex items-center gap-2 text-sm">
              <Camera className="w-5 h-5" />
              <span>{isDragActive ? "Drop here" : "Add Photo"}</span>
            </div>
          </div>
          <button 
            type="submit"
            className="px-6 py-2 bg-terracotta-700 text-white rounded-full font-medium hover:bg-terracotta-800 transition-all flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Post
          </button>
        </div>
      </form>

      {/* Feed List */}
      <div className="space-y-6">
        {posts.map(post => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-100 text-stone-500 rounded-full flex items-center justify-center font-bold">
                  {post.name[0]}
                </div>
                <div>
                  <p className="font-bold text-stone-800">{post.name}</p>
                  <p className="text-xs text-stone-400">{new Date(post.timestamp).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <p className="text-stone-700 leading-relaxed">
              {post.message} <span className="text-terracotta-700 font-medium">{hashtag}</span>
            </p>
            {post.photo && (
              <img 
                src={post.photo} 
                className="w-full rounded-2xl border border-stone-100 shadow-sm"
                referrerPolicy="no-referrer"
              />
            )}
          </motion.div>
        ))}
        {posts.length === 0 && (
          <div className="text-center py-12 text-stone-400 italic">
            No posts yet. Be the first to share!
          </div>
        )}
      </div>
    </section>
  );
}

function ScannerSection({ rsvps, onCheckIn, onCapture }: { rsvps: RSVP[], onCheckIn: (id: string, photo?: string) => Promise<void>, onCapture: (post: any) => Promise<void> }) {
  const [scanning, setScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<RSVP | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (scanning && !scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      scannerRef.current.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [scanning]);

  function onScanSuccess(decodedText: string) {
    const rsvp = rsvps.find(r => r.id === decodedText);
    if (rsvp) {
      setScannedResult(rsvp);
      setScanning(false);
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    }
  }

  function onScanFailure(error: any) {
    // console.warn(`Code scan error = ${error}`);
  }

  const handleCheckInSubmit = async () => {
    if (scannedResult) {
      await onCheckIn(scannedResult.id, photo || undefined);
      setScannedResult(null);
      setPhoto(null);
      alert("Check-in successful!");
    }
  };

  const handleCaptureSubmit = async () => {
    if (scannedResult && photo) {
      await onCapture({
        name: scannedResult.name,
        message: "Captured a moment! 📸",
        photo,
      });
      setScannedResult(null);
      setPhoto(null);
      alert("Moment captured and shared!");
    } else {
      alert("Please take a photo first!");
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] },
    multiple: false 
  } as any);

  return (
    <section className="py-24 px-4 max-w-xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-4xl font-serif text-stone-800 mb-4">Guest Scanner</h2>
        <p className="text-stone-500 uppercase tracking-widest text-sm">Scan your QR code to check-in</p>
      </div>

      {!scanning && !scannedResult && (
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-stone-100 text-center space-y-6">
          <div className="w-24 h-24 bg-terracotta-50 text-terracotta-700 rounded-full flex items-center justify-center mx-auto">
            <Scan className="w-12 h-12" />
          </div>
          <p className="text-stone-600">Ready to check-in? Have your QR code ready.</p>
          <button 
            onClick={() => setScanning(true)}
            className="w-full py-4 bg-terracotta-700 text-white rounded-xl font-bold hover:bg-terracotta-800 transition-all"
          >
            Start Scanning
          </button>
        </div>
      )}

      {scanning && (
        <div className="bg-white p-4 rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
          <div id="reader" className="w-full"></div>
          <button 
            onClick={() => setScanning(false)}
            className="w-full mt-4 py-2 text-stone-400 hover:text-stone-600"
          >
            Cancel
          </button>
        </div>
      )}

      {scannedResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl border border-stone-100 space-y-6"
        >
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-serif text-stone-800">Welcome, {scannedResult.name}!</h3>
            <p className="text-terracotta-700 font-medium">Seat Number: {scannedResult.seatNumber || "TBD"}</p>
          </div>

          <div className="space-y-4">
            <div {...getRootProps()} className="border-2 border-dashed border-stone-200 rounded-2xl p-8 text-center cursor-pointer hover:border-terracotta-300 transition-colors">
              <input {...getInputProps()} />
              {photo ? (
                <img src={photo} className="w-full h-48 object-cover rounded-xl" />
              ) : (
                <div className="space-y-2 text-stone-400">
                  <Camera className="w-8 h-8 mx-auto" />
                  <p className="text-sm">Tap to take/upload a photo</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleCheckInSubmit}
                className="py-4 bg-terracotta-700 text-white rounded-xl font-bold hover:bg-terracotta-800 transition-all flex flex-col items-center gap-1"
              >
                <CheckCircle className="w-5 h-5" />
                <span className="text-xs">Check-In</span>
              </button>
              <button 
                onClick={handleCaptureSubmit}
                className="py-4 bg-stone-800 text-white rounded-xl font-bold hover:bg-stone-900 transition-all flex flex-col items-center gap-1"
              >
                <ImageIcon className="w-5 h-5" />
                <span className="text-xs">Capture Moment</span>
              </button>
            </div>
            
            <button 
              onClick={() => setScannedResult(null)}
              className="w-full py-2 text-stone-400 text-sm"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}

function AdminSection({ content, setContent, rsvps, setRsvps, isAdmin, setIsAdmin }: { 
  content: WeddingContent, 
  setContent: any, 
  rsvps: RSVP[], 
  setRsvps: any,
  isAdmin: boolean, 
  setIsAdmin: any 
}) {
  const [password, setPassword] = useState('');
  const [editingRsvp, setEditingRsvp] = useState<RSVP | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === content.adminPassword) {
      setIsAdmin(true);
    } else {
      alert("Incorrect password!");
    }
  };

  const updateContentField = async (key: string, value: string) => {
    const newContent = { ...content, [key]: value };
    setContent(newContent);
    await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newContent)
    });
  };

  const handleUpdateRsvp = async (rsvp: RSVP) => {
    await fetch(`/api/rsvps/${rsvp.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rsvp)
    });
    setEditingRsvp(null);
  };

  const handleDeleteRsvp = async (id: string) => {
    if (confirm("Delete this RSVP?")) {
      await fetch(`/api/rsvps/${id}`, {
        method: 'DELETE'
      });
    }
  };

  if (!isAdmin) {
    return (
      <section className="py-24 px-4 max-w-md mx-auto">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-xl border border-stone-100 space-y-6">
          <div className="text-center space-y-2">
            <Settings className="w-12 h-12 text-stone-300 mx-auto" />
            <h2 className="text-2xl font-serif text-stone-800">Admin Login</h2>
          </div>
          <input 
            type="password" 
            placeholder="Enter Password"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:ring-2 focus:ring-terracotta-500"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button className="w-full py-3 bg-stone-800 text-white rounded-xl font-bold hover:bg-stone-900 transition-all">
            Login
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="py-24 px-4 max-w-7xl mx-auto space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-serif text-stone-800">Admin Dashboard</h2>
        <button 
          onClick={() => setIsAdmin(false)}
          className="flex items-center gap-2 text-stone-400 hover:text-stone-600"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Content Management */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 space-y-4">
            <h3 className="text-xl font-serif text-stone-800 flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Site Content
            </h3>
            <div className="space-y-4">
              {[
                { label: "Couple Names", key: "coupleNames" },
                { label: "Wedding Date", key: "weddingDate" },
                { label: "Hashtag", key: "hashtag" },
                { label: "Ceremony Venue", key: "ceremonyVenue" },
                { label: "Reception Venue", key: "receptionVenue" },
              ].map(field => (
                <div key={field.key} className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase">{field.label}</label>
                  <input 
                    className="w-full px-3 py-2 bg-stone-50 rounded-lg border border-stone-100 text-sm"
                    value={(content as any)[field.key]}
                    onChange={e => updateContentField(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RSVP Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-serif text-stone-800 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Guest List ({rsvps.length})
              </h3>
              <button 
                onClick={() => {
                  const csv = [
                    ["Name", "Contact", "Attending", "Guests", "Meal", "Seat"],
                    ...rsvps.map(r => [r.name, r.contact, r.attending ? "Yes" : "No", r.guestCount, r.mealPreference, r.seatNumber || ""])
                  ].map(e => e.join(",")).join("\n");
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.setAttribute('hidden', '');
                  a.setAttribute('href', url);
                  a.setAttribute('download', 'rsvps.csv');
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="text-xs font-bold text-terracotta-700 hover:underline"
              >
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-stone-400 uppercase text-xs border-b border-stone-100">
                  <tr>
                    <th className="py-3 px-2">Name</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Guests</th>
                    <th className="py-3 px-2">Seat</th>
                    <th className="py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {rsvps.map(rsvp => (
                    <tr key={rsvp.id} className="hover:bg-stone-50 transition-colors">
                      <td className="py-4 px-2 font-medium">{rsvp.name}</td>
                      <td className="py-4 px-2">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          rsvp.attending ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        )}>
                          {rsvp.attending ? "Attending" : "Declined"}
                        </span>
                      </td>
                      <td className="py-4 px-2">{rsvp.guestCount}</td>
                      <td className="py-4 px-2 font-mono text-terracotta-700">{rsvp.seatNumber || "-"}</td>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setEditingRsvp(rsvp)}
                            className="p-1 hover:text-terracotta-700"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteRsvp(rsvp.id)}
                            className="p-1 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              const win = window.open('', '_blank');
                              win?.document.write(`
                                <html>
                                  <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:serif;">
                                    <h1>${rsvp.name}</h1>
                                    <p>Seat: ${rsvp.seatNumber || "TBD"}</p>
                                    <div id="qr"></div>
                                    <script src="https://unpkg.com/qrcode-generator@1.4.4/qrcode.js"></script>
                                    <script>
                                      var qr = qrcode(0, 'M');
                                      qr.addData('${rsvp.id}');
                                      qr.make();
                                      document.getElementById('qr').innerHTML = qr.createImgTag(5);
                                    </script>
                                    <button onclick="window.print()" style="margin-top:20px;">Print Pass</button>
                                  </body>
                                </html>
                              `);
                            }}
                            className="p-1 hover:text-blue-600"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit RSVP Modal */}
      <AnimatePresence>
        {editingRsvp && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full space-y-6"
            >
              <h3 className="text-2xl font-serif text-stone-800">Edit Guest: {editingRsvp.name}</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase">Seat Number</label>
                  <input 
                    className="w-full px-4 py-2 bg-stone-50 rounded-xl border border-stone-200"
                    placeholder="e.g. Table 1, Seat A"
                    value={editingRsvp.seatNumber || ''}
                    onChange={e => setEditingRsvp({...editingRsvp, seatNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 uppercase">Guest Count</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-2 bg-stone-50 rounded-xl border border-stone-200"
                    value={editingRsvp.guestCount}
                    onChange={e => setEditingRsvp({...editingRsvp, guestCount: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleUpdateRsvp(editingRsvp)}
                  className="flex-1 py-3 bg-terracotta-700 text-white rounded-xl font-bold"
                >
                  Save Changes
                </button>
                <button 
                  onClick={() => setEditingRsvp(null)}
                  className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}

