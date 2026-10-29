import * as cheerio from "cheerio";
import { NodeHtmlMarkdown } from "node-html-markdown";

const nhm = new NodeHtmlMarkdown({
  bulletMarker: "-",
  maxConsecutiveNewlines: 2,
  ignore: ["img", "script", "style", "nav", "footer", "header", "iframe", "noscript"],
});

/**
 * Converts an HTML string (e.g. from job postings) into clean, readable Markdown.
 * Strips scripts, styles, navigation, footer, and other non-content tags.
 * Performs all processing locally with zero external API calls.
 */
export function convertHtmlToMarkdown(html?: string | null): string {
  if (!html || !html.trim()) {
    return "";
  }

  try {
    // 1. Clean HTML via Cheerio by removing non-content and layout tags
    const $ = cheerio.load(html, null, false);
    $("script, style, nav, footer, header, iframe, noscript, img").remove();

    const cleanedHtml = $.html();
    if (!cleanedHtml || !cleanedHtml.trim()) {
      return "";
    }

    // 2. Convert to Markdown using NodeHtmlMarkdown
    const markdown = nhm.translate(cleanedHtml);

    // 3. Clean up any excessive blank lines
    const lines = markdown.split(/\r?\n/);
    const cleanedLines: string[] = [];
    let prevBlank = false;

    for (const line of lines) {
      if (!line.trim()) {
        if (!prevBlank) {
          cleanedLines.push("");
        }
        prevBlank = true;
      } else {
        cleanedLines.push(line);
        prevBlank = false;
      }
    }

    return cleanedLines.join("\n").trim();
  } catch (error) {
    console.error("Error during HTML to Markdown conversion:", error);
    return "";
  }
}
