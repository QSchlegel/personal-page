import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Quirin Schlegel",
  description: "How this site handles your data: newsletter, PDF downloads, analytics, processors, and your GDPR rights.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article>
      <header className="article-head">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="subtitle">
          How this site collects and uses personal data, and your rights under the GDPR / DSGVO. Last updated 30 May
          2026.
        </p>
      </header>

      <div className="article-body">
        <h2>Controller</h2>
        <p>
          Quirin Schlegel — <em>[ADD POSTAL ADDRESS]</em> —{" "}
          <a href="mailto:mail@quirinschlegel.com">mail@quirinschlegel.com</a>.
        </p>

        <h2>What we collect and why</h2>
        <p>
          <strong>Newsletter.</strong> If you subscribe, we store your email address (and name, if provided), the consent
          text and version you agreed to, the time of consent, and your IP address. We use a confirmed double opt-in:
          your address is only added to the active list after you click the confirmation link. Lawful basis: your
          consent (Art. 6(1)(a) GDPR). We use it solely to email you when a new six-pager is published. You can withdraw
          consent at any time via the one-click unsubscribe link in every email.
        </p>
        <p>
          <strong>PDF downloads.</strong> When you request a PDF, we store your email address, which document you
          requested, the time, and your IP address, so we can email you the download link. Lawful basis: taking steps at
          your request and our legitimate interest in delivering the file you asked for (Art. 6(1)(b)/(f) GDPR). We do{" "}
          <em>not</em> add you to the newsletter unless you separately tick that box.
        </p>
        <p>
          <strong>Authentication.</strong> If you use the passkey-secured chat, we store the account and passkey data
          needed to sign you in. Lawful basis: performance of the service you requested (Art. 6(1)(b) GDPR).
        </p>
        <p>
          <strong>Analytics.</strong> We use Umami, a privacy-friendly, cookieless analytics tool, to understand
          aggregate traffic. It does not set tracking cookies or build cross-site profiles.
        </p>
        <p>
          <strong>Reading theme.</strong> Your light/dark reading preference is stored in your browser&apos;s
          localStorage only. It never reaches our servers.
        </p>

        <h2>Processors</h2>
        <p>
          We share data with service providers who process it on our behalf under data-processing agreements:{" "}
          <strong>Resend</strong> (email delivery), <strong>Railway</strong> (hosting), and our self-hosted Umami
          instance (analytics). Where a processor transfers data outside the EU/EEA, that transfer is covered by
          appropriate safeguards such as the EU Standard Contractual Clauses.
        </p>

        <h2>Retention</h2>
        <p>
          Newsletter subscribers are kept until you unsubscribe; on unsubscribe we mark the record inactive and erase it
          on request. Download records are kept only as long as needed for the service and abuse prevention, then
          deleted.
        </p>

        <h2>Your rights</h2>
        <p>
          Under the GDPR you have the right to access, rectification, erasure, restriction, data portability, and to
          object, as well as to withdraw consent at any time. To exercise any of these, email{" "}
          <a href="mailto:mail@quirinschlegel.com">mail@quirinschlegel.com</a>. You also have the right to lodge a
          complaint with a supervisory authority.
        </p>

        <h2>Changes</h2>
        <p>We may update this policy; material changes will be reflected by the date above.</p>
      </div>
    </article>
  );
}
