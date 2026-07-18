/**
 * Structured content for long-form legal/policy pages (Privacy, Terms). These are documents, not
 * reusable UI strings, so they live as web-app content modules rather than in the shared i18n
 * catalogue. `reviewNote` is optional — set it to flag a draft pending legal review; omit it on
 * finished documents.
 */
export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDoc = {
  /** Document title (h1). */
  title: string;
  /** Breadcrumb label for the current page. */
  breadcrumb: string;
  /** Human "Last updated" line. */
  updated: string;
  /** Optional disclaimer callout at the top of the article (omit on finished documents). */
  reviewNote?: string;
  /** Opening paragraphs before the numbered sections. */
  intro: string[];
  sections: LegalSection[];
};
