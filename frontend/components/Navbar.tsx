import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

// Dark theme matching the image
const THEME = {
  colors: {
    bg: '#0F1419',
    bgSecondary: '#1A1F29',
    textPrimary: '#E8EAED',
    textSecondary: '#9AA0A6',
    border: '#2D3139',
    hover: '#252A34',
    accent: '#00D09C',
  }
};

export default function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Original tabs from your code
 const links = [
  { name: "Dashboard", path: "/dashboard", icon: "📊" },
  { name: "Prediction", path: "/predict", icon: "🎯" },
  { name: "Screener", path: "/screener", icon: "🔍" },
  { name: "Events", path: "/events", icon: "📅" },
  { name: "Event Impact", path: "/event-impact", icon: "📈" },
];

  return (
    <>
      <div style={{ height: '70px' }} />

      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '70px',
        backgroundColor: THEME.colors.bg,
        borderBottom: `1px solid ${THEME.colors.border}`,
        boxShadow: isScrolled ? '0 2px 12px rgba(0,0,0,0.4)' : 'none',
        transition: 'all 0.3s ease',
        zIndex: 1000,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ 
          maxWidth: '1400px',
          width: '100%', 
          height: '100%',
          margin: '0 auto', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 32px',
        }}>
          
          {/* Logo - Left (LASTICA style from image) */}
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                background: 'linear-gradient(135deg, #6366F1, #3B82F6)', 
                borderRadius: '6px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ width: '16px', height: '3px', background: 'white', borderRadius: '2px' }}></div>
                <div style={{ width: '16px', height: '3px', background: 'white', borderRadius: '2px' }}></div>
              </div>
              <div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: THEME.colors.textPrimary, 
                  letterSpacing: '0.5px',
                  lineHeight: '1'
                }}>
                  LASTICA
                </div>
                <div style={{ 
                  fontSize: '10px', 
                  color: THEME.colors.textSecondary,
                  letterSpacing: '1px',
                  fontWeight: '500',
                  marginTop: '2px'
                }}>
                  LASTICA
                </div>
              </div>
            </div>
          </Link>

          {/* Navigation Links - Center (Desktop) - ORIGINAL TABS */}
          <div className="desktop-only" style={{ 
            display: 'flex', 
            gap: '4px', 
            alignItems: 'center',
            flex: 1,
            marginLeft: '48px'
          }}>
            {links.map((link) => {
              const isActive = router.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  style={{
                    textDecoration: 'none',
                    color: isActive ? THEME.colors.accent : THEME.colors.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                    fontSize: '14px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'rgba(0, 208, 156, 0.1)' : 'transparent',
                    border: isActive ? `1px solid rgba(0, 208, 156, 0.2)` : '1px solid transparent',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = THEME.colors.hover;
                      e.currentTarget.style.color = THEME.colors.textPrimary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = THEME.colors.textSecondary;
                    }
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{link.icon}</span>
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Right Section */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            flexShrink: 0
          }}>
            
            {/* Search Icon (Desktop) */}
            <button className="desktop-only" style={{ 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              color: THEME.colors.textSecondary
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = THEME.colors.hover;
              e.currentTarget.style.color = THEME.colors.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = THEME.colors.textSecondary;
            }}
            >
              <svg
                style={{ width: '20px', height: '20px' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>

            {/* Mobile Hamburger */}
            <button 
              className="mobile-only"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                fontSize: '24px', 
                cursor: 'pointer', 
                color: THEME.colors.textPrimary,
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {menuOpen && (
          <div style={{
            position: 'absolute',
            top: '70px',
            left: 0,
            right: 0,
            backgroundColor: THEME.colors.bgSecondary,
            borderBottom: `1px solid ${THEME.colors.border}`,
            padding: '20px 32px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 999,
          }}>
            {links.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                onClick={() => setMenuOpen(false)}
                style={{
                  textDecoration: 'none',
                  color: router.pathname === link.path ? THEME.colors.accent : THEME.colors.textSecondary,
                  fontWeight: '600',
                  fontSize: '15px',
                  padding: '12px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <span style={{ fontSize: '18px' }}>{link.icon}</span>
                {link.name}
              </Link>
            ))}
            
            {/* Mobile Search */}
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              color: THEME.colors.textSecondary,
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'left'
            }}>
              <svg
                style={{ width: '20px', height: '20px' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Search
            </button>
          </div>
        )}
      </nav>
      
      {/* Responsive CSS */}
      <style jsx global>{`
        .desktop-only { display: flex; }
        .mobile-only { display: none; }
        
        @media (max-width: 1024px) {
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
        
        * { box-sizing: border-box; }
      `}</style>
    </>
  );
}
