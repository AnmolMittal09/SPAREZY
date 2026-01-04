
import React from 'react';

const TharLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] animate-fade-in">
      <style>{`
        @keyframes wheelSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); } 
        }
        @keyframes bodyBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes roadMove {
          0% { transform: translateX(0); }
          100% { transform: translateX(-40px); }
        }
        .thar-wheel {
          transform-origin: center;
          animation: wheelSpin 0.6s linear infinite;
        }
        .thar-body-container {
          animation: bodyBounce 0.8s ease-in-out infinite;
        }
        .thar-road {
          animation: roadMove 0.4s linear infinite;
        }
      `}</style>

      <div className="relative w-64 h-40">
        <svg viewBox="0 0 240 140" className="w-full h-full overflow-visible">
          <defs>
            {/* Paint Gradient */}
            <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#dc2626', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: '#991b1b', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#7f1d1d', stopOpacity: 1 }} />
            </linearGradient>
            
            {/* Window Gradient */}
            <linearGradient id="windowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#334155', stopOpacity: 0.8 }} />
              <stop offset="50%" style={{ stopColor: '#475569', stopOpacity: 0.6 }} />
              <stop offset="100%" style={{ stopColor: '#1e293b', stopOpacity: 0.9 }} />
            </linearGradient>

            {/* Reflection */}
            <linearGradient id="reflection" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 0 }} />
              <stop offset="50%" style={{ stopColor: '#ffffff', stopOpacity: 0.15 }} />
              <stop offset="100%" style={{ stopColor: '#ffffff', stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          {/* Road */}
          <g className="thar-road">
            <line x1="-100" y1="115" x2="340" y2="115" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="20 15" />
            <rect x="-100" y="116" width="440" height="4" fill="#F1F5F9" opacity="0.5" />
          </g>

          {/* Realistic Car Body */}
          <g className="thar-body-container" transform="translate(200, 0) scale(-1, 1)">
            {/* Shadow */}
            <ellipse cx="85" cy="112" rx="65" ry="6" fill="#000" opacity="0.1" />

            {/* Main Body Shell */}
            <path 
              d="M10 75 L10 65 Q10 58 18 58 L45 58 L60 32 Q64 25 72 25 L145 25 Q152 25 152 35 L152 75 L165 75 Q170 75 170 82 L170 95 L155 95 L155 90 L135 90 L135 95 L45 95 L45 90 L25 90 L25 95 L5 95 L5 82 Q5 75 10 75 Z" 
              fill="url(#bodyGradient)"
              stroke="#450a0a"
              strokeWidth="1"
            />

            {/* Fenders / Wheel Arches */}
            <path d="M22 95 Q40 68 58 95" fill="#1e293b" />
            <path d="M112 95 Q130 68 148 95" fill="#1e293b" />

            {/* Windows */}
            <path d="M64 54 L76 31 L110 31 L110 54 Z" fill="url(#windowGradient)" />
            <path d="M114 31 L145 31 L145 54 L114 54 Z" fill="url(#windowGradient)" />
            
            {/* Window Highlight/Reflection */}
            <path d="M70 35 L105 35 L105 38 L72 38 Z" fill="#fff" opacity="0.1" />

            {/* Door Handle */}
            <rect x="118" y="62" width="12" height="3" rx="1.5" fill="#0f172a" />

            {/* Headlight */}
            <path d="M10 75 Q7 75 7 70 Q7 65 10 65" fill="#fef08a" className="animate-pulse" />
            <circle cx="10" cy="70" r="2.5" fill="#fff" opacity="0.8" />

            {/* Tail Light */}
            <rect x="165" y="78" width="5" height="12" rx="1" fill="#991b1b" />

            {/* Roof Rack Detail */}
            <line x1="80" y1="23" x2="140" y2="23" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />

            {/* Side Mirror */}
            <path d="M60 54 Q55 54 55 50 L58 50 Z" fill="#0f172a" />

            {/* Body Reflection Line */}
            <path d="M20 78 L150 78" stroke="url(#reflection)" strokeWidth="8" />
          </g>

          {/* Wheels (Positioned relative to scale/transform) */}
          <g className="thar-body-container">
            {/* Front Wheel */}
            <g className="thar-wheel" transform="translate(160, 95)">
              <circle cx="0" cy="0" r="16" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
              <circle cx="0" cy="0" r="11" fill="#64748b" stroke="#334155" strokeWidth="1" />
              {/* Spokes */}
              {[0, 60, 120, 180, 240, 300].map(deg => (
                <rect key={deg} x="-1" y="-10" width="2" height="10" fill="#94a3b8" transform={`rotate(${deg})`} />
              ))}
              <circle cx="0" cy="0" r="3" fill="#1e293b" />
            </g>

            {/* Rear Wheel */}
            <g className="thar-wheel" transform="translate(70, 95)">
              <circle cx="0" cy="0" r="16" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
              <circle cx="0" cy="0" r="11" fill="#64748b" stroke="#334155" strokeWidth="1" />
              {/* Spokes */}
              {[0, 60, 120, 180, 240, 300].map(deg => (
                <rect key={deg} x="-1" y="-10" width="2" height="10" fill="#94a3b8" transform={`rotate(${deg})`} />
              ))}
              <circle cx="0" cy="0" r="3" fill="#1e293b" />
            </g>
          </g>
        </svg>
      </div>
      
      <div className="flex flex-col items-center gap-3 mt-4">
        <p className="text-[11px] font-black text-slate-400 tracking-[0.4em] uppercase">
          Scanning Catalog
        </p>
        <div className="flex gap-1">
           <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></div>
           <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></div>
           <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce"></div>
        </div>
      </div>
    </div>
  );
};

export default TharLoader;
