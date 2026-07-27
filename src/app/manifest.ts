import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'તળપદા કોળી સમાજ ઈનામ વિતરણ ૨૦૨૬',
    short_name: 'કોળી સમાજ ઈનામ',
    description: 'તળપદા કોળી સમાજ પાલિતાણા ઈનામ વિતરણ અને વિદ્યાર્થી ડેટા એન્ટ્રી એપ',
    start_url: '/',
    display: 'standalone',
    background_color: '#065F46',
    theme_color: '#10B981',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
