import { toast } from "sonner";
import { getPrintHeaderHTML, getPrintWatermarkHTML } from "@/components/PrintHeader";
import { getPrintFooterHTML } from "@/components/PrintFooter";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function downloadAsPDF(html: string, filename: string) {
  const container = document.createElement("div");
  // Set styles to make it look like a proper document
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.padding = "40px";
  container.style.backgroundColor = "#ffffff";
  container.style.fontFamily = "system-ui, -apple-system, sans-serif";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    toast.info("Generating PDF...");
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });
    
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = 595; // A4 width in pts
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });
    
    // Add image, scaling it to fit A4 width
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save(`${filename}.pdf`);
    toast.success("Downloaded as PDF");
  } catch (error) {
    console.error("PDF export failed:", error);
    toast.error("Failed to generate PDF");
  } finally {
    document.body.removeChild(container);
  }
}

export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (data.length === 0) { toast.error("No data to export"); return; }
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? "";
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(",")
    ),
  ].join("\n");
  downloadFile(csv, `${filename}.csv`, "text/csv");
}

export function exportToJSON(data: Record<string, any>[], filename: string) {
  if (data.length === 0) { toast.error("No data to export"); return; }
  downloadFile(JSON.stringify(data, null, 2), `${filename}.json`, "application/json");
}

export function printTable(title: string, data: Record<string, any>[], columns: { key: string; label: string }[]) {
  const html = `
    <html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { font-size: 18px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; }
      @media print { body { padding: 0; } }
    </style></head><body>
      ${getPrintWatermarkHTML()}
      ${getPrintHeaderHTML()}
      <h1 style="text-align: center; margin-top: 20px;">${title}</h1>
      <table>
        <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
        <tbody>${data.map((row) => `<tr>${columns.map((c) => `<td>${row[c.key] ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      ${getPrintFooterHTML()}
    </body></html>`;
  triggerPrint(html);
}

export async function downloadTableAsPDF(title: string, data: Record<string, any>[], columns: { key: string; label: string }[]) {
  const html = `
    <html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { font-size: 18px; margin-bottom: 16px; text-align: center; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; text-transform: uppercase; }
    </style></head><body>
      ${getPrintWatermarkHTML()}
      ${getPrintHeaderHTML()}
      <h1>${title}</h1>
      <table>
        <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
        <tbody>${data.map((row) => `<tr>${columns.map((c) => `<td>${row[c.key] ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      ${getPrintFooterHTML()}
    </body></html>`;
  await downloadAsPDF(html, title.toLowerCase().replace(/\s+/g, '_'));
}

export function triggerPrint(html: string) {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    // Wait for images to load before printing
    win.onload = () => {
      win.print();
    };
    // Fallback if onload doesn't trigger correctly in some browsers
    setTimeout(() => {
      if (win.document.readyState === 'complete') {
        win.print();
      }
    }, 1000);
  }
}

export async function downloadAsPNG(html: string, filename: string) {
  const container = document.createElement("div");
  // Set styles to make it look like a proper document
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.padding = "40px";
  container.style.backgroundColor = "#ffffff";
  container.style.fontFamily = "system-ui, -apple-system, sans-serif";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    toast.info("Generating image...");
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });
    
    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Downloaded as PNG");
  } catch (error) {
    console.error("PNG export failed:", error);
    toast.error("Failed to generate image");
  } finally {
    document.body.removeChild(container);
  }
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${filename}`);
}
