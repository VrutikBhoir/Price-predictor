import type { AppProps } from 'next/app';
import '../styles/globals.css';
import Navbar from '../components/Navbar';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Navbar />
      
      <Component {...pageProps} />

      <style jsx global>{`
        html, body, #__next { height: 100%; }
        * { box-sizing: border-box; }
      `}</style>
    </>
  );
}
