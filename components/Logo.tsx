import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'white'; // 'white' for dark backgrounds (Login page)
}

const Logo: React.FC<LogoProps> = ({ className = "h-16 w-auto", variant = 'default' }) => {
  // Brand Colors
  const HYUNDAI_BLUE = "#002c5f";
  const MAHINDRA_RED = "#d9232d"; // Slightly brighter for logo
  
  // Text Colors based on variant
  const titleColor = variant === 'white' ? '#ffffff' : '#002c5f';
  const subtitleColor = variant === 'white' ? '#d1d5db' : '#374151';

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 300 200" 
      className={className} 
      role="img" 
      aria-label="Sparezy Logo"
    >
      {/* --- ICON GRAPHIC (Top) --- */}
      {/* Shifted down to y=90 to provide ample top padding */}
      <g transform="translate(150, 90)">
        {/* Gear Outline (Half Circle) */}
        <path 
          d="M-55,10 A60,60 0 1,1 55,10" 
          fill="none" 
          stroke={HYUNDAI_BLUE} 
          strokeWidth="8" 
          strokeLinecap="round"
        />
        {/* Gear Teeth */}
        <g fill={HYUNDAI_BLUE}>
             {[...Array(7)].map((_, i) => (
                <rect 
                    key={i} 
                    x="-6" 
                    y="-68" 
                    width="12" 
                    height="12" 
                    rx="2"
                    transform={`rotate(${(i - 3) * 25})`} 
                />
             ))}
        </g>

        {/* Inner Parts (Piston & Spark Plug) */}
        <g transform="scale(0.8) translate(0, -10)">
            {/* Piston (Left) */}
            <path 
                d="M-25,-20 L-25,20 L-10,20 L-10,-20 Z" 
                fill="none" 
                stroke={titleColor} 
                strokeWidth="3"
                transform="rotate(-20)"
            />
            <circle cx="-17" cy="-25" r="8" fill="none" stroke={titleColor} strokeWidth="3" transform="rotate(-20)" />
            
            {/* Shock/Spring (Center) */}
            <path 
                d="M-5,-15 Q5,-15 5,-10 Q-5,-5 -5,0 Q5,5 5,10 Q-5,15 -5,20" 
                fill="none" 
                stroke={MAHINDRA_RED} 
                strokeWidth="3"
            />
            
            {/* Brake Disc (Right) */}
            <path 
                d="M20,0 A15,15 0 1,1 20,-1 A15,15 0 0,1 20,0" 
                fill="none" 
                stroke={titleColor} 
                strokeWidth="3"
                transform="rotate(20)"
            />
        </g>

        {/* Swooshes (Underneath Graphic) */}
        <path 
           d="M-70,25 Q0,5 70,25" 
           fill="none" 
           stroke={HYUNDAI_BLUE} 
           strokeWidth="4" 
           strokeLinecap="round"
        />
        <path 
           d="M-60,32 Q0,12 60,32" 
           fill="none" 
           stroke={MAHINDRA_RED} 
           strokeWidth="4" 
           strokeLinecap="round"
        />
      </g>

      {/* --- TEXT (Bottom) --- */}
      {/* Shifted down relative to graphic */}
      <text 
        x="150" 
        y="155" 
        textAnchor="middle" 
        fill={titleColor} 
        fontFamily="sans-serif" 
        fontWeight="900" 
        fontSize="42"
        letterSpacing="1"
      >
        SPAREZY
      </text>
      
      <g transform="translate(150, 175)">
        <line x1="-90" y1="-5" x2="-80" y2="-5" stroke={subtitleColor} strokeWidth="1" />
        <text 
            x="0" 
            y="0" 
            textAnchor="middle" 
            fill={subtitleColor} 
            fontFamily="sans-serif" 
            fontWeight="600" 
            fontSize="10" 
            letterSpacing="1"
        >
            MAHINDRA &amp; HYUNDAI
        </text>
        <line x1="80" y1="-5" x2="90" y2="-5" stroke={subtitleColor} strokeWidth="1" />
        <text 
            x="0" 
            y="12" 
            textAnchor="middle" 
            fill={subtitleColor} 
            fontFamily="sans-serif" 
            fontWeight="500" 
            fontSize="8" 
            letterSpacing="2"
        >
            GENUINE SPARE PARTS
        </text>
      </g>
    </svg>
  );
};

export default Logo;