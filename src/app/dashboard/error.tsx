'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard Error:', error);
  }, [error]);

  return (
    <div className="flex-1 min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="p-4 bg-amber-100 text-amber-700 rounded-3xl mb-4">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2">
        ડેશબોર્ડ લોડ કરવામાં ક્ષતિ (Dashboard Load Error)
      </h2>
      <p className="text-xs sm:text-sm font-bold text-slate-500 max-w-md mb-6 leading-relaxed">
        ડેટા લોડ કરતી વખતે સમસ્યા આવી છે. કૃપા કરીને નીચે આપેલા બટન પર કલિક કરી પ્રયાસ કરો.
      </p>
      <div className="flex gap-3">
        <Button
          onClick={() => reset()}
          className="rounded-xl bg-primary hover:bg-primary/90 text-white font-black px-5 py-2.5 shadow-md flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          ફરી લોડ કરો
        </Button>
      </div>
    </div>
  );
}
