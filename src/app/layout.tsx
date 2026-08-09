import type { Metadata } from 'next';
import { Inter, Merriweather, EB_Garamond, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const merriweather = Merriweather({
  variable: '--font-merriweather',
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  display: 'swap',
  preload: false,
});

const ebGaramond = EB_Garamond({
  variable: '--font-garamond',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: 'EReader — Lector EPUB Local',
  description:
    'Lector de EPUB moderno con síntesis de voz (Edge TTS), anotaciones y resaltados. Toda la privacidad: el libro nunca sale de tu dispositivo.',
  keywords: ['epub', 'lector', 'ebook', 'tts', 'text to speech', 'anotaciones'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${merriweather.variable} ${ebGaramond.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
