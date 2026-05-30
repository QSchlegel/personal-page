import type { Metadata } from "next";

// Hidden for now: not linked in the footer and excluded from the sitemap;
// noindex keeps it out of search until the details are finalised.
export const metadata: Metadata = {
  title: "Impressum — Quirin Schlegel",
  description: "Legal disclosure / Impressum pursuant to § 5 DDG.",
  alternates: { canonical: "/impressum" },
  robots: { index: false, follow: false },
};

export default function ImpressumPage() {
  return (
    <article>
      <header className="article-head">
        <p className="eyebrow">Legal</p>
        <h1>Impressum</h1>
        <p className="subtitle">Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz).</p>
      </header>

      <div className="article-body">
        <h2>Diensteanbieter</h2>
        <p>
          Quirin Schlegel
          <br />
          <em>[Straße &amp; Hausnummer — ADD]</em>
          <br />
          <em>[PLZ &amp; Ort — ADD]</em>
          <br />
          Deutschland
        </p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href="mailto:mail@quirinschlegel.com">mail@quirinschlegel.com</a>
        </p>

        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>
          Quirin Schlegel, Anschrift wie oben.
        </p>

        <h2>Haftung für Inhalte und Links</h2>
        <p>
          Die Inhalte dieser Seiten wurden mit größtmöglicher Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und
          Aktualität wird jedoch keine Gewähr übernommen. Für Inhalte externer Links sind ausschließlich deren Betreiber
          verantwortlich.
        </p>

        <h2>EU-Streitschlichtung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
          <a href="https://ec.europa.eu/consumers/odr/" rel="noreferrer noopener" target="_blank">
            https://ec.europa.eu/consumers/odr/
          </a>
          . Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </div>
    </article>
  );
}
