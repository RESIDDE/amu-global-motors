import logo from "@/assets/logo_old_backup.png";

// For use inside React DOM trees (like AuthorityToSell.tsx)
export function PrintHeader() {
  return (
    <div className="flex items-center justify-start border-b-[3px] border-[#1D3557] pb-4 mb-6">
      <img src={logo} alt="Bee Tee Logo" className="w-[106px] h-[106px] object-contain mr-6" />
      <div className="text-left text-[#1D3557]">
        <h1 className="font-sans font-black text-3xl mb-1 tracking-wider uppercase m-0" style={{ fontFamily: '"Arial Black", Impact, sans-serif' }}>
          BEE TEE AUTOMOBILE
        </h1>
        <p className="text-sm font-bold mb-1 mt-0 text-black">
          Address: <span className="font-normal">Plot 36A &amp; 36B Wole Soyinka way, Cadastral zone B15, Jahi, Abuja.</span>
        </p>
        <p className="text-sm font-bold mb-1 mt-0 text-black">
          Tel: <span className="font-normal">09077777211, 09162228881</span>
        </p>
        <p className="text-sm font-bold mb-0 mt-0 text-black">
          Email: <span className="font-normal text-[#007BFF] underline italic">beeteeautomobile@gmail.com</span>
        </p>
      </div>
    </div>
  );
}

// For use inside string-based html window popups (like Invoices.tsx, Sales.tsx, exportHelpers.ts)
// Note: Since Vite compiles assets, we use window.location.origin to ensure the image resolves.
export function getPrintHeaderHTML() {
  return `
    <div style="display: flex; align-items: center; justify-content: flex-start; border-bottom: 3px solid #1D3557; padding-bottom: 16px; margin-bottom: 24px;">
      <img src="${window.location.origin}${logo}" style="width: 110px; height: 110px; object-fit: contain; margin-right: 24px;" />
      <div style="text-align: left; color: #1D3557;">
        <h1 style="font-family: 'Arial Black', Impact, sans-serif; font-size: 28px; margin: 0 0 4px 0; letter-spacing: 1px; color: #1D3557; text-transform: uppercase;">
          BEE TEE AUTOMOBILE
        </h1>
        <p style="font-size: 13px; font-weight: bold; margin: 4px 0; color: #000;">
          Address: <span style="font-weight: normal;">Plot 36A &amp; 36B Wole Soyinka way, Cadastral zone B15, Jahi, Abuja.</span>
        </p>
        <p style="font-size: 13px; font-weight: bold; margin: 4px 0; color: #000;">
          Tel: <span style="font-weight: normal;">09077777211, 09162228881</span>
        </p>
        <p style="font-size: 13px; font-weight: bold; margin: 4px 0; color: #000;">
          Email: <span style="color: #007BFF; text-decoration: underline; font-style: italic; font-weight: normal;">beeteeautomobile@gmail.com</span>
        </p>
      </div>
    </div>
  `;
}

// React component for watermark (used in AuthorityToSell.tsx preview)
export function PrintWatermark() {
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.4] select-none">
      <img src={logo} alt="Watermark" className="w-[500px] h-[500px] object-contain" />
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
      opacity: 0.4;
      user-select: none;
    ">
      <img src="${logoUrl}" style="width: 500px; height: 500px; object-fit: contain;" />
    </div>
  `;
}
