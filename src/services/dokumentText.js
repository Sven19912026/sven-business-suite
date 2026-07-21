import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

const MAX_INDEX_ZEICHEN = 120000;
const MAX_PDF_SEITEN = 80;
const MAX_OCR_SEITEN = 5;
const MIN_DIGITALER_TEXT = 120;

function textNormalisieren(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_INDEX_ZEICHEN);
}

async function ocrErkennen(quelle, onProgress) {
  const { recognize } = await import("tesseract.js");
  const ergebnis = await recognize(quelle, "deu+eng", {
    logger: (meldung) => {
      if (meldung.status === "recognizing text" && Number.isFinite(meldung.progress)) {
        onProgress?.(Math.round(meldung.progress * 100));
      }
    },
  });
  return textNormalisieren(ergebnis?.data?.text);
}

async function pdfTextAuslesen(datei, onProgress) {
  const arrayBuffer = await datei.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  if (pdf.numPages > MAX_PDF_SEITEN) {
    throw new Error(`PDF hat ${pdf.numPages} Seiten; maximal ${MAX_PDF_SEITEN} Seiten werden indexiert.`);
  }

  const texte = [];
  for (let seitenNummer = 1; seitenNummer <= pdf.numPages; seitenNummer += 1) {
    const seite = await pdf.getPage(seitenNummer);
    const inhalt = await seite.getTextContent();
    const text = inhalt.items
      .map((item) => (typeof item?.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    if (text.trim()) texte.push(`Seite ${seitenNummer}: ${text}`);
    onProgress?.(Math.round((seitenNummer / pdf.numPages) * 70));
  }

  const digitalerText = textNormalisieren(texte.join("\n"));
  if (digitalerText.length >= MIN_DIGITALER_TEXT) {
    onProgress?.(100);
    return { text: digitalerText, quelle: "pdf-text" };
  }

  const ocrTexte = [];
  const seitenLimit = Math.min(pdf.numPages, MAX_OCR_SEITEN);
  for (let seitenNummer = 1; seitenNummer <= seitenLimit; seitenNummer += 1) {
    const seite = await pdf.getPage(seitenNummer);
    const viewport = seite.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await seite.render({ canvasContext: context, viewport }).promise;
    const text = await ocrErkennen(canvas, (fortschritt) => {
      const basis = 70 + ((seitenNummer - 1) / seitenLimit) * 30;
      onProgress?.(Math.min(99, Math.round(basis + (fortschritt / seitenLimit) * 0.3)));
    });
    if (text) ocrTexte.push(`Seite ${seitenNummer}: ${text}`);
  }

  onProgress?.(100);
  return { text: textNormalisieren(ocrTexte.join("\n")), quelle: "pdf-ocr" };
}

export async function dokumentTextExtrahieren(datei, onProgress) {
  if (!datei) return { text: "", quelle: "keine" };
  const typ = String(datei.type || "").toLowerCase();
  const name = String(datei.name || "").toLowerCase();

  if (typ === "application/pdf" || name.endsWith(".pdf")) {
    return pdfTextAuslesen(datei, onProgress);
  }

  if (typ.startsWith("image/")) {
    const text = await ocrErkennen(datei, onProgress);
    return { text, quelle: "bild-ocr" };
  }

  if (
    typ.startsWith("text/")
    || name.endsWith(".txt")
    || name.endsWith(".csv")
    || name.endsWith(".md")
  ) {
    onProgress?.(100);
    return { text: textNormalisieren(await datei.text()), quelle: "textdatei" };
  }

  return { text: "", quelle: "nicht-unterstuetzt" };
}
