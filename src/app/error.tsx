'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Runtime Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center font-sans">
      <div className="p-4 bg-red-100 text-red-600 rounded-3xl mb-4">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2">
        કંઈક ભૂલ થઈ છે (An error occurred)
      </h2>
      <p className="text-sm font-bold text-slate-500 max-w-md mb-6 leading-relaxed">
        એપ્લિકેશન માં ટેકનિકલ સમસ્યા આવી છે. કૃપા કરીને રીફ્રેશ કરો અથવા ફરી પ્રયાસ કરો.
      </p>
      <div className="flex gap-3">
        <Button
          onClick={() => reset()}
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 shadow-lg flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          ફરી પ્રયાસ કરો (Try Again)
        </Button>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="rounded-2xl font-black px-6 py-3"
        >
          પેજ રીફ્રેશ કરો
        </Button>
      </div>
    </div>
  );
}
