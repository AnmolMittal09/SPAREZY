import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'white'; // 'white' for dark backgrounds (Login page)
}

const Logo: React.FC<LogoProps> = ({ className = "h-16 w-auto", variant = 'default' }) => {
  // SaaS Brand Colors (Teal & Deep Slate)
  const PRIMARY_COLOR = "#0d9488"; // Teal 600
  const SECONDARY_COLOR = "#334155"; // Slate 700
  
  // Text Colors based on variant
  const titleColor = variant === 'white' ? '#ffffff' : '#0f172a'; // Slate 900
  const subtitleColor = variant === 'white' ? '#cbd5e1' : '#64748b'; // Slate 500
  const iconPrimary = variant === 'white' ? '#2dd4bf' : PRIMARY_COLOR; // Teal 400 vs 600
  const iconSecondary = variant === 'white' ? '#94a3b8' : SECONDARY_COLOR;

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 300 80" 
      className={className} 
      role="img" 
      aria-label="Sparezy Logo"
    >
      {/* --- LOGO ICON (Left Aligned) --- */}
      <g transform="translate(40, 40)">
        {/* Abstract Hexagon/Box 'S' Shape */}
        <path 
          d="M-20,-10 L-10,-25 L15,-25 L25,-10 L15,5 L-10,5 Z" 
          fill="none" 
          stroke={iconPrimary} 
          strokeWidth="6" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          d="M20,10 L10,25 L-15,25 L-25,10 L-15,-5 L10,-5 Z" 
          fill="none" 
          stroke={iconSecondary} 
          strokeWidth="6" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Center Connecting Dot */}
        <circle cx="0" cy="0" r="4" fill={iconPrimary} />
      </g>

      {/* --- TEXT (Right Aligned) --- */}
      <g transform="translate(80, 0)">
        <text 
          x="0" 
          y="48" 
          textAnchor="start" 
          fill={titleColor} 
          fontFamily="sans-serif" 
          fontWeight="800" 
          fontSize="42"
          letterSpacing="-1"
        >
          Sparezy
        </text>
        
        <text 
            x="2" 
            y="68" 
            textAnchor="start" 
            fill={subtitleColor} 
            fontFamily="sans-serif" 
            fontWeight="600" 
            fontSize="9" 
            letterSpacing="2.5"
            className="uppercase"
        >
            Smart Inventory System
        </text>
      </g>
    </svg>
  );
};

export default Logo;