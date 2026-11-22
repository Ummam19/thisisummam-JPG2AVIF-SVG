import { useEffect, useRef, useState } from "react";
import { Download, Moon, RefreshCw, Sun } from "lucide-react";
import {
  convertJpeg,
  downloadBlob,
  formatBytes,
  isJpeg,
  outputName,
  type ConvertedImage,
  type OutputFormat,
} from "@/lib/convert";

type Theme = "dark" | "light";
type Phase = "idle" | "converting" | "done" | "error";

type SourceFile = {
  file: File;
  url: string;
};

const READY = "Output Preview / Ready for conversion";

function FileGlyph() {
  return (
    <div className="file-glyph" aria-hidden="true">
      <svg viewBox="0 0 64 72" width="74" height="78" fill="none">
        <path
          d="M16 8h22.5L50 19.5V60a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6z"
          stroke="currentColor"
          strokeWidth="2.4"
        />
        <path d="M38 8.5V20H50" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="30" cy="40" r="8" stroke="currentColor" strokeWidth="2.4" />
      </svg>
      <span className="plus-badge">
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}

export function Converter() {
  const [format, setFormat] = useState<OutputFormat>("avif");
  const [theme, setTheme] = useState<Theme>("dark");
  const [source, setSource] = useState<SourceFile | null>(null);
  const [result, setResult] = useState<ConvertedImage | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState(READY);
  const [hot, setHot] = useState(false);

  const sourceRef = useRef<SourceFile | null>(null);
  const resultRef = useRef<ConvertedImage | null>(null);
  sourceRef.current = source;
  resultRef.current = result;

  useEffect(() => {
    const stored = window.localStorage.getItem("ummam-theme");
    const next: Theme =
      stored === "light" || document.documentElement.classList.contains("light") ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
  }, []);

  useEffect(() => {
    return () => {
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    };
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    window.localStorage.setItem("ummam-theme", next);
  }

  function clearResult() {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }

  function takeFile(file: File | undefined) {
    if (!file) return;
    if (!isJpeg(file)) {
      setPhase("error");
      setMessage("Hanya file JPG yang didukung.");
      return;
    }
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file) };
    });
    clearResult();
    setPhase("idle");
    setMessage(READY);
  }

  function chooseFormat(next: OutputFormat) {
    if (phase === "converting" || next === format) return;
    setFormat(next);
    clearResult();
    setPhase("idle");
    setMessage(READY);
  }

  async function onConvert() {
    if (!source) {
      setPhase("error");
      setMessage("Drag & drop JPG file dulu, atau Browse File.");
      return;
    }
    if (phase === "converting") return;
    setPhase("converting");
    setMessage(`Converting to ${format.toUpperCase()}…`);
    clearResult();
    try {
      const converted = await convertJpeg(source.file, format);
      setResult(converted);
      setPhase("done");
      const saved =
        source.file.size > converted.bytes
          ? ` · ${Math.round((1 - converted.bytes / source.file.size) * 100)}% lebih kecil`
          : "";
      setMessage(
        `Output Preview / ${converted.width}×${converted.height} · ${formatBytes(converted.bytes)}${saved}`,
      );
    } catch {
      setPhase("error");
      setMessage("Konversi gagal. Coba file JPG lain.");
    }
  }

  function onDownload() {
    if (!result || !source) return;
    downloadBlob(result.blob, outputName(source.file.name, format));
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1 className="brand-name">thisisummam</h1>
          <p className="brand-sub">convert JPG to (AVIF or SVG)</p>
        </div>
        <div className="controls">
          <span className="convert-label">Convert to:</span>
          <div className="format-switch" role="group" aria-label="Convert to">
            <button
              type="button"
              className={format === "avif" ? "format-btn is-active" : "format-btn"}
              aria-pressed={format === "avif"}
              onClick={() => chooseFormat("avif")}
            >
              AVIF
            </button>
            <button
              type="button"
              className={format === "svg" ? "format-btn is-active" : "format-btn"}
              aria-pressed={format === "svg"}
              onClick={() => chooseFormat("svg")}
            >
              SVG
            </button>
          </div>
          <div className="theme-switch" role="group" aria-label="Tema">
            <button
              type="button"
              className={theme === "dark" ? "theme-btn is-active" : "theme-btn"}
              aria-pressed={theme === "dark"}
              aria-label="Mode gelap"
              onClick={() => applyTheme("dark")}
            >
              <Moon size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={theme === "light" ? "theme-btn is-active" : "theme-btn"}
              aria-pressed={theme === "light"}
              aria-label="Mode terang"
              onClick={() => applyTheme("light")}
            >
              <Sun size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <section className="stage">
        <div className="panel">
          <label
            className={hot ? "dropzone is-hot" : "dropzone"}
            onDragOver={(event) => {
              event.preventDefault();
              setHot(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHot(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setHot(false);
              takeFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              className="file-input"
              type="file"
              accept="image/jpeg,.jpg,.jpeg"
              onChange={(event) => {
                takeFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {source ? (
              <>
                <img className="shot" src={source.url} alt="" />
                <p className="file-meta">
                  {source.file.name} · {formatBytes(source.file.size)}
                </p>
                <p className="browse-line">atau Browse File</p>
              </>
            ) : (
              <>
                <FileGlyph />
                <p className="drop-title">Drag & drop JPG file here</p>
                <p className="browse-line">atau Browse File</p>
              </>
            )}
          </label>
        </div>

        <div className="panel">
          <div className={phase === "converting" ? "output is-busy" : "output"}>
            <h2 className="output-title">Output</h2>
            {result ? (
              <div className="output-frame">
                <img src={result.url} alt={`Pratinjau ${format.toUpperCase()}`} />
              </div>
            ) : (
              <div className="output-marks" aria-hidden="true">
                <div className="format-mark">AVIF/SVG</div>
                <div className="output-dl">
                  <Download size={46} strokeWidth={1.75} />
                </div>
              </div>
            )}
            <p className={phase === "error" ? "output-caption is-error" : "output-caption"} aria-live="polite">
              {message}
            </p>
          </div>
        </div>
      </section>

      <div className="actions">
        <button type="button" className="action action-convert" onClick={onConvert} disabled={phase === "converting"}>
          <span>Convert</span>
          <RefreshCw size={20} strokeWidth={2.25} className={phase === "converting" ? "spin" : undefined} />
        </button>
        <button
          type="button"
          className={result ? "action action-download is-ready" : "action action-download"}
          onClick={onDownload}
          disabled={!result}
        >
          <span>Download</span>
          <Download size={20} strokeWidth={2.25} />
        </button>
      </div>
    </main>
  );
}
