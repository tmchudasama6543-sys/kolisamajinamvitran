'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, MapPin, BarChart3, Loader2,
  Award, TrendingUp, Sparkles,
  ZoomIn, ZoomOut, Download, RefreshCw, X
} from 'lucide-react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

type StudentData = {
  id: string; name: string; standard: string; villageName: string;
  percentage: number; mobileNumber: string; totalMarks: number;
  obtainedMarks: number; submissionDateTime: any;
};

export default function AdminPanel() {
  const firestore = useFirestore();

  // Preview states
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });

  const openPreview = (src: string) => {
    setPreviewSrc(src);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    window.location.hash = 'preview';
  };
  const closePreview = () => {
    setPreviewSrc(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    if (window.location.hash.includes('preview')) window.location.hash = '';
  };

  const onMove = useCallback((e: any) => {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setPan({ x: clientX - dragOrigin.current.x, y: clientY - dragOrigin.current.y });
  }, [dragging]);

  const onStart = useCallback((e: any) => {
    setDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOrigin.current.x = clientX - pan.x;
    dragOrigin.current.y = clientY - pan.y;
  }, [pan]);

  const onEnd = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [dragging, onMove, onEnd]);

  useEffect(() => {
    const fn = () => {
      if (!window.location.hash.includes('preview')) {
        setPreviewSrc(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);

  const handleDownload = () => {
    if (!previewSrc) return;
    const a = document.createElement('a'); a.href = previewSrc;
    a.download = `doc_${Date.now()}.jpg`; a.click();
  };

  const studentsQuery = useMemoFirebase(
    () => query(collection(firestore, 'students'), orderBy('submissionDateTime', 'desc'), limit(5000)),
    [firestore]
  );
  const { data: students, isLoading } = useCollection<StudentData>(studentsQuery);

  const stats = useMemo(() => {
    if (!students || students.length === 0) return {
      total: 0,
      totalVillages: 0,
      avgPercentage: '0.00',
      highScorers: 0,
      gradeBreakdown: [
        { label: '90%+ (A1 શ્રેણી)', count: 0, barColor: 'bg-emerald-500' },
        { label: '80% - 89% (A2 શ્રેણી)', count: 0, barColor: 'bg-teal-500' },
        { label: '70% - 79% (B1 શ્રેણી)', count: 0, barColor: 'bg-indigo-500' },
        { label: '60% - 69% (B2 શ્રેણી)', count: 0, barColor: 'bg-amber-500' },
        { label: '60% થી ઓછા', count: 0, barColor: 'bg-slate-400' },
      ],
      villageDist: [],
      smartVillageDist: [] as [string, number, number][],
      standardDist: [],
    };

    const vMap = new Map<string, number>();
    const vSumMap = new Map<string, number>();
    const sMap = new Map<string, number>();
    let sumPct = 0;
    let highCount = 0;
    let g90 = 0, g80 = 0, g70 = 0, g60 = 0, gLess = 0;

    for (const s of students) {
      const pct = typeof s.percentage === 'number' ? s.percentage : parseFloat(s.percentage || '0');
      if (s.villageName) {
         vMap.set(s.villageName, (vMap.get(s.villageName) || 0) + 1);
         vSumMap.set(s.villageName, (vSumMap.get(s.villageName) || 0) + pct);
      }
      if (s.standard) sMap.set(s.standard, (sMap.get(s.standard) || 0) + 1);
      
      sumPct += pct;
      if (pct >= 80) highCount++;
      if (pct >= 90) g90++;
      else if (pct >= 80) g80++;
      else if (pct >= 70) g70++;
      else if (pct >= 60) g60++;
      else gLess++;
    }

    const total = students.length;
    const avgPct = total > 0 ? (sumPct / total).toFixed(2) : '0.00';

    return {
      total,
      totalVillages: vMap.size,
      avgPercentage: avgPct,
      highScorers: highCount,
      gradeBreakdown: [
        { label: '90%+ (A1 શ્રેણી)', count: g90, barColor: 'bg-emerald-500' },
        { label: '80% - 89% (A2 શ્રેણી)', count: g80, barColor: 'bg-teal-500' },
        { label: '70% - 79% (B1 શ્રેણી)', count: g70, barColor: 'bg-indigo-500' },
        { label: '60% - 69% (B2 શ્રેણી)', count: g60, barColor: 'bg-amber-500' },
        { label: '60% થી ઓછા', count: gLess, barColor: 'bg-slate-400' },
      ],
      villageDist: Array.from(vMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15),
      smartVillageDist: Array.from(vMap.entries())
        .filter(([_, count]) => count >= 2)
        .map(([v, count]) => [v, count, vSumMap.get(v)! / count] as [string, number, number])
        .sort((a, b) => b[2] - a[2])
        .slice(0, 10),
      standardDist: Array.from(sMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15),
    };
  }, [students]);

  if (isLoading) return <div className="p-6"><Skeleton className="h-60 w-full rounded-3xl" /></div>;

  // ── Shared Photo Preview Modal ────────────────────────────────────────────
  const PreviewModal = previewSrc ? (
    <div className="fixed inset-0 z-[9999] bg-black/96 flex flex-col animate-in fade-in duration-200 touch-none overflow-hidden">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-2 rounded-full border border-white/20">
        <button onClick={() => setZoom(z => Math.max(z - 0.4, 0.5))} className="h-9 w-9 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-white font-black text-xs font-mono px-2 min-w-[3rem] text-center select-none">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(z + 0.4, 5))} className="h-9 w-9 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="h-9 w-9 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
          <RefreshCw className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-white/20 mx-1" />
        <button onClick={handleDownload} className="h-9 w-9 rounded-full text-white hover:bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
          <Download className="h-4 w-4" />
        </button>
      </div>
      <div className="absolute top-4 right-4 z-[10000]">
        <button onClick={closePreview} className="h-11 w-11 rounded-full bg-white/15 text-white border border-white/20 hover:bg-white/25 active:scale-95 flex items-center justify-center transition-all">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="w-full h-full flex items-center justify-center p-14 overflow-hidden" onClick={closePreview}>
        <div onClick={e => e.stopPropagation()}>
          <img
            src={previewSrc} alt="Preview"
            onMouseDown={onStart}
            onTouchStart={onStart}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              maxHeight: '82vh', maxWidth: '94vw', objectFit: 'contain',
              transition: dragging ? 'none' : 'transform 0.15s ease-out',
              userSelect: 'none', pointerEvents: dragging ? 'none' : 'auto',
              cursor: dragging ? 'grabbing' : 'grab',
            }}
            className="shadow-2xl rounded-xl"
            onDragStart={e => e.preventDefault()}
          />
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-xs font-semibold select-none">
        બંધ કરવા ↑ ઉપર ટૅપ કરો
      </div>
    </div>
  ) : null;

  // ── Dashboard Overview ────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
        {/* Hero card */}
        <Card className="rounded-[2rem] border-none shadow-2xl bg-gradient-to-br from-primary via-accent to-primary overflow-hidden">
          <CardContent className="p-6 sm:p-10 flex items-center gap-5">
            <div className="bg-white/15 p-4 rounded-[1.5rem] backdrop-blur-md border border-white/20">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-4xl sm:text-6xl font-black tracking-tighter text-white leading-tight">{stats.total}</h2>
              <p className="text-xs sm:text-sm font-bold uppercase text-white/80 tracking-widest">કુલ નોંધાયેલ વિદ્યાર્થીઓ</p>
            </div>
          </CardContent>
        </Card>

        {/* Smart KPI Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">કુલ નોંધાયેલ ગામો</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.totalVillages}</h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
              <MapPin className="h-7 w-7" />
            </div>
          </Card>

          <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">સરેરાશ ટકાવારી</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.avgPercentage}%</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Award className="h-7 w-7" />
            </div>
          </Card>

          <Card className="rounded-2xl border-none shadow-md bg-white p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">૮૦% થી વધુ ટકા વાળા</p>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{stats.highScorers} <span className="text-xs font-bold text-slate-400">વિદ્યાર્થી</span></h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <TrendingUp className="h-7 w-7" />
            </div>
          </Card>
        </div>

        {/* Grade Breakdown Analysis */}
        <Card className="rounded-[1.5rem] sm:rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="p-5 border-b bg-slate-50/50 flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-slate-900">ટકાવારી શ્રેણી વિશ્લેષણ (Grade Breakdown)</h3>
                <p className="text-xs font-bold text-slate-400">વિદ્યાર્થીઓના પરિણામનું શ્રેણી વાઈઝ વિભાજન</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {stats.gradeBreakdown.map(gb => {
              const pctOfTotal = stats.total > 0 ? ((gb.count / stats.total) * 100).toFixed(1) : '0';
              return (
                <div key={gb.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-black">
                    <span className="text-slate-800">{gb.label}</span>
                    <span className="text-slate-600 font-mono">{gb.count} વિદ્યાર્થી ({pctOfTotal}%)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", gb.barColor)} style={{ width: `${pctOfTotal}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Stats cards for Village and Standard distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { title: '📍 ગામ મુજબ વિતરણ', data: stats.villageDist, icon: MapPin, color: 'bg-teal-50 text-teal-700', barBg: 'bg-teal-500' },
            { title: '📊 ધોરણ મુજબ વિતરણ', data: stats.standardDist, icon: BarChart3, color: 'bg-indigo-50 text-indigo-700', barBg: 'bg-indigo-500' },
          ].map(sec => (
            <Card key={sec.title} className="rounded-[1.5rem] sm:rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
              <CardHeader className="p-5 border-b bg-slate-50/50 flex flex-row items-center gap-3">
                <div className={cn('p-2.5 rounded-xl shadow-sm', sec.color)}><sec.icon className="h-5 w-5" /></div>
                <h3 className="text-base font-black uppercase tracking-tight text-slate-900">{sec.title}</h3>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {sec.data.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-4">કોઈ ડેટા ઉપલબ્ધ નથી</p>
                ) : (
                  sec.data.map(([label, count]) => {
                    const share = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm font-black">
                          <span className="text-slate-800">{label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">{share}%</span>
                            <Badge className={cn('h-7 px-3 rounded-lg font-black border-none text-xs', sec.color)}>{count}</Badge>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-300", sec.barBg)} style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Smart Village Analytics */}
        <Card className="rounded-[1.5rem] sm:rounded-[2rem] border-none shadow-xl bg-white overflow-hidden mt-2">
          <CardHeader className="p-5 border-b bg-rose-50/50 flex flex-row items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shadow-sm">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight text-slate-900">સ્માર્ટ ગામ (ટોપ ૧૦)</h3>
              <p className="text-xs font-bold text-slate-400">સૌથી ઊંચી સરેરાશ ટકાવારી ધરાવતા ગામો (ઓછામાં ઓછા ૨ વિદ્યાર્થી)</p>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {stats.smartVillageDist.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-4">કોઈ ડેટા ઉપલબ્ધ નથી</p>
            ) : (
              stats.smartVillageDist.map(([village, count, avgPct], idx) => {
                return (
                  <div key={village} className="space-y-1.5 flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center font-black text-rose-600 shadow-sm border border-rose-100">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800">{village}</div>
                        <div className="text-xs font-bold text-slate-400">{count} વિદ્યાર્થીઓ</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none px-3 py-1 text-sm font-black rounded-xl">
                        {avgPct.toFixed(2)}%
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
      {PreviewModal}
    </>
  );
}
