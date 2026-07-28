export interface PickedSubtitle {
  fileName: string;
  vtt: string;
}

// Convert SubRip (.srt) to WebVTT: add the header and fix comma decimals in
// timestamps (00:00:01,000 -> 00:00:01.000). VTT files are passed through.
export function srtToVtt(content: string, fileName: string): string {
  const text = content.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (fileName.toLowerCase().endsWith(".vtt") || text.trimStart().startsWith("WEBVTT")) {
    return text.trimStart().startsWith("WEBVTT") ? text : `WEBVTT\n\n${text}`;
  }
  const body = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body}`;
}

// Pick a .srt/.vtt file (hidden input works in Electron + browser) and read it.
export function pickSubtitle(): Promise<PickedSubtitle | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".srt,.vtt,text/vtt";
    input.style.display = "none";
    input.onchange = async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return resolve(null);
      const content = await file.text();
      resolve({ fileName: file.name, vtt: srtToVtt(content, file.name) });
    };
    window.addEventListener(
      "focus",
      () => setTimeout(() => input.parentNode && !input.files?.length && (document.body.removeChild(input), resolve(null)), 500),
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
  });
}
