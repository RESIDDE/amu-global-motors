import logo from "@/assets/logo.png";
import { MapPin, Phone, Mail } from "lucide-react";

// For use inside React DOM trees (like AuthorityToSell.tsx)
export function PrintHeader() {
  return (
    <div className="flex items-start justify-start pb-4 mb-6 relative border-b-2 border-black/10">
      <img src={logo} alt="AMU Logo" className="w-[140px] h-[140px] object-contain mr-6 mt-2" />
      <div className="flex-1 text-left relative">
        <div className="absolute top-0 right-0">
          <span className="text-[13px] font-black text-black font-sans uppercase">RC 1860127</span>
        </div>
        <h1 
          className="font-serif font-black text-[34px] mt-3 mb-1 tracking-wide" 
          style={{ 
            color: '#c99a4e',
            WebkitTextStroke: '0.8px #222',
            textShadow: '2px 2px 0px rgba(0,0,0,0.1)'
          }}
        >
          A.M.U GLOBAL MOTORS NIG. LTD.
        </h1>
        <p className="text-[15px] font-black mb-3 text-black leading-snug font-sans tracking-[0.2px]">
          Dealer in all kind of Motors Cars, Import & Export, Car Hire,<br />
          Supplies, General Contractor, Merchandise.
        </p>
        <div className="space-y-[6px] mt-4 text-[14px] font-bold text-black border-l-2 border-[#d81b60]/20 pl-3">
          <div className="flex items-start gap-1.5">
            <span className="text-[#d81b60] shrink-0 mt-0.5"><MapPin size={18} fill="currentColor" strokeWidth={1} className="text-white"/></span>
            <span>:263 Tafawa Balewa Road, Central<br/>Business District Area Abuja, Nigeria.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#d81b60] shrink-0"><Phone size={18} fill="currentColor" strokeWidth={1} className="text-white"/></span>
            <span className="font-extrabold tracking-wide">:0803 628 8314</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold">
            <span className="text-[#d81b60] shrink-0"><Mail size={18} fill="currentColor" strokeWidth={1} className="text-[#d81b60]"/></span>
            <span>:amuglobalmotors@gmail.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// For use inside string-based html window popups (like Invoices.tsx, Sales.tsx, exportHelpers.ts)
export function getPrintHeaderHTML() {
  return `
    <div style="display: flex; align-items: flex-start; justify-content: flex-start; padding-bottom: 16px; margin-bottom: 24px; position: relative; border-bottom: 2px solid rgba(0,0,0,0.1);">
      <img src="${window.location.origin}${logo}" style="width: 140px; height: 140px; object-fit: contain; margin-right: 24px; margin-top: 8px;" />
      <div style="flex: 1; text-align: left; position: relative;">
        <div style="position: absolute; top: -10px; right: 0;">
          <span style="font-size: 13px; font-weight: 900; color: #000; font-family: sans-serif;">RC 1860127</span>
        </div>
        <h1 style="font-family: Georgia, serif; font-size: 34px; font-weight: 900; margin: 12px 0 6px 0; color: #c99a4e; -webkit-text-stroke: 0.8px #222; letter-spacing: 0.5px;">
          A.M.U GLOBAL MOTORS NIG. LTD.
        </h1>
        <p style="font-family: sans-serif; font-size: 15px; font-weight: 900; margin: 0 0 16px 0; color: #000; line-height: 1.4; letter-spacing: 0.2px;">
          Dealer in all kind of Motors Cars, Import & Export, Car Hire,<br/>Supplies, General Contractor, Merchandise.
        </p>
        <div style="margin-top: 12px; font-size: 14px; color: #000; font-family: sans-serif; font-weight: bold; padding-left: 12px; border-left: 2px solid rgba(216, 27, 96, 0.2);">
          <div style="display: flex; align-items: flex-start; margin-bottom: 6px;">
            <span style="color: #d81b60; margin-right: 6px; font-size: 16px;">📍</span>
            <span>:263 Tafawa Balewa Road, Central<br/>Business District Area Abuja, Nigeria.</span>
          </div>
          <div style="display: flex; align-items: center; margin-bottom: 6px; font-weight: 900; letter-spacing: 0.5px;">
            <span style="color: #d81b60; margin-right: 6px; font-size: 16px;">📱</span>
            <span>:0803 628 8314</span>
          </div>
          <div style="display: flex; align-items: center; margin-bottom: 6px; font-weight: 600;">
            <span style="color: #d81b60; margin-right: 6px; font-size: 16px;">✉️</span>
            <span>:amuglobalmotors@gmail.com</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// React component for watermark (used in AuthorityToSell.tsx preview)
export function PrintWatermark() {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.12] select-none mix-blend-multiply">
      <img src={logo} alt="Watermark" className="w-[500px] h-[500px] object-contain grayscale" />
    </div>
  );
}

// For use inside string-based html window popups (like Invoices.tsx, Sales.tsx, exportHelpers.ts)
export function getPrintWatermarkHTML() {
  const logoUrl = `${window.location.origin}${logo}`;
  return `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
      opacity: 0.12;
      user-select: none;
      filter: grayscale(100%);
      mix-blend-mode: multiply;
    ">
      <img src="${logoUrl}" style="width: 500px; height: 500px; object-fit: contain;" />
    </div>
  `;
}
