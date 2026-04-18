import React from 'react';

// For use inside React DOM trees (like AuthorityToSell.tsx)
export function PrintFooter() {
  return (
    <div className="mt-auto relative w-full overflow-hidden print:block hidden h-40 bg-white">
      <svg className="absolute bottom-0 left-0 w-full h-full" viewBox="0 0 1000 150" preserveAspectRatio="none">
        {/* Right Swoosh - Royal Blue */}
        <path 
          d="M 400 150 C 650 150 900 80 1000 0 L 1000 150 Z" 
          fill="#1e3a8a" 
        />
        {/* Right Swoosh - Navy */}
        <path 
          d="M 600 150 C 800 150 950 120 1000 40 L 1000 150 Z" 
          fill="#0f172a" 
        />
        {/* Left Small Swoosh - Navy (Mirror Swoosh - Slightly Larger and Flatter) */}
        <path 
          d="M 0 132 C 80 132 180 150 240 150 L 0 150 Z" 
          fill="#0f172a" 
        />
      </svg>
    </div>
  );
}

export function getPrintFooterHTML() {
  return `
    <div style="margin-top: auto; position: relative; width: 100%; height: 150px; overflow: hidden; background: white; page-break-inside: avoid;">
      <svg style="position: absolute; bottom: 0; left: 0; width: 100%; height: 100%;" viewBox="0 0 1000 150" preserveAspectRatio="none">
        <path d="M 400 150 C 650 150 900 80 1000 0 L 1000 150 Z" fill="#1e3a8a" />
        <path d="M 600 150 C 800 150 950 120 1000 40 L 1000 150 Z" fill="#0f172a" />
        <path d="M 0 132 C 80 132 180 150 240 150 L 0 150 Z" fill="#0f172a" />
      </svg>
    </div>
  `;
}
