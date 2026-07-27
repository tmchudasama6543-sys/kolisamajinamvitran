import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-center font-sans">
      <h1 className="text-4xl font-black text-slate-800 mb-2">૪૦૪ - પાનું મળ્યું નથી</h1>
      <p className="text-sm font-bold text-slate-500 mb-6">તમે જે પાનું શોધી રહ્યા છો તે અસ્તિત્વમાં નથી.</p>
      <Link href="/dashboard" className="px-6 py-3 rounded-2xl bg-emerald-500 text-white font-black text-sm shadow-lg hover:bg-emerald-600 transition-colors">
        મુખ્ય ડેશબોર્ડ પર પાછા જાઓ
      </Link>
    </div>
  );
}
