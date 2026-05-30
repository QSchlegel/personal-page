import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const main = { backgroundColor: "#f3efe7", fontFamily: "Georgia, 'Times New Roman', serif", padding: "28px 0" };
const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #d8cfbc",
  borderRadius: "10px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "34px",
};
const eyebrow = {
  color: "#0f5a63",
  fontFamily: "monospace",
  fontSize: "11px",
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  margin: "0 0 10px",
};
const heading = { color: "#1b1813", fontSize: "23px", lineHeight: "1.2", margin: "0 0 14px" };
const text = { color: "#33302a", fontSize: "16px", lineHeight: "1.6", margin: "0 0 14px" };
const small = { color: "#8a7f6c", fontSize: "12px", lineHeight: "1.5", margin: "16px 0 0" };
const button = {
  backgroundColor: "#0a3f46",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontFamily: "monospace",
  fontSize: "14px",
  padding: "12px 22px",
  textDecoration: "none",
};
const hr = { borderColor: "#e6ddcc", margin: "26px 0 14px" };

function Shell({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>{children}</Container>
      </Body>
    </Html>
  );
}

export function PdfDeliveryEmail({ title, downloadUrl }: { title: string; downloadUrl: string }) {
  return (
    <Shell preview={`Your PDF of “${title}” is ready`}>
      <Text style={eyebrow}>Knowledge Vault</Text>
      <Heading style={heading}>Your six-pager is ready</Heading>
      <Text style={text}>Thanks for your interest in &ldquo;{title}.&rdquo; Here is your download link:</Text>
      <Section style={{ margin: "8px 0 4px" }}>
        <Button href={downloadUrl} style={button}>
          Download the PDF
        </Button>
      </Section>
      <Text style={small}>
        This link expires in 7 days. If you didn&apos;t request this, you can safely ignore this email — no newsletter
        subscription was created.
      </Text>
    </Shell>
  );
}

export function DoubleOptInEmail({ confirmUrl }: { confirmUrl: string }) {
  return (
    <Shell preview="Confirm your newsletter subscription">
      <Text style={eyebrow}>Newsletter</Text>
      <Heading style={heading}>Confirm your subscription</Heading>
      <Text style={text}>
        Please confirm you&apos;d like to receive an email when a new six-pager is published. We&apos;ll only email you
        about new releases.
      </Text>
      <Section style={{ margin: "8px 0 4px" }}>
        <Button href={confirmUrl} style={button}>
          Confirm subscription
        </Button>
      </Section>
      <Text style={small}>
        If you didn&apos;t request this, simply ignore this email and no subscription will be created. Your address is
        not added to any list until you confirm.
      </Text>
    </Shell>
  );
}

export function BroadcastEmail({
  paragraphs,
  articleUrl,
  articleTitle,
  unsubscribeUrl,
}: {
  paragraphs: string[];
  articleUrl?: string;
  articleTitle?: string;
  unsubscribeUrl: string;
}) {
  return (
    <Shell preview={paragraphs[0] ?? "A new six-pager is available"}>
      <Text style={eyebrow}>Knowledge Vault · New release</Text>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={index === 0 ? heading : text}>
          {paragraph}
        </Text>
      ))}
      {articleUrl ? (
        <Section style={{ margin: "8px 0 4px" }}>
          <Button href={articleUrl} style={button}>
            {articleTitle ? `Read “${articleTitle}”` : "Read it on the web"}
          </Button>
        </Section>
      ) : null}
      <Hr style={hr} />
      <Text style={small}>
        You&apos;re receiving this because you confirmed a subscription to Quirin Schlegel&apos;s six-pager newsletter.{" "}
        <Link href={unsubscribeUrl} style={{ color: "#8a7f6c", textDecoration: "underline" }}>
          Unsubscribe
        </Link>{" "}
        at any time.
      </Text>
    </Shell>
  );
}
