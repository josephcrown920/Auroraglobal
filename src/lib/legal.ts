// Versioned legal documents. Bump the version when content changes — it
// invalidates prior acceptances for that document.
export const LEGAL_VERSION = "2026-06-10";
export const COMPANY = {
  name: "Aurora Studio",
  product: "Aurora",
  email: "support@aurora.studio",
  jurisdiction: "United States",
};

export type LegalDoc = {
  slug: "terms" | "privacy" | "cookies" | "refunds" | "acceptable-use";
  title: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
};

export const LEGAL: Record<LegalDoc["slug"], LegalDoc> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    summary:
      "These terms govern your use of Aurora Studio. By creating an account or generating content you agree to them.",
    sections: [
      {
        heading: "1. The service",
        body: [
          "Aurora Studio is an AI creative studio that turns reference photos and prompts into stylised photos and short videos.",
          "We orchestrate third-party AI providers (Google Gemini, Replicate, Hugging Face, Sync.so, Inference.net, HeyGen and others). Their outputs may vary and are not guaranteed to be accurate, safe, or fit for any particular purpose.",
        ],
      },
      {
        heading: "2. Your account",
        body: [
          "You must be at least 13 years old (or the digital consent age in your country) to use Aurora. You are responsible for the activity that happens under your account, including keeping your credentials confidential.",
          "We may suspend or terminate accounts that violate these terms, abuse the service, or attempt to bypass safety controls.",
        ],
      },
      {
        heading: "3. Content & ownership",
        body: [
          "You retain ownership of the reference materials you upload. By uploading them you grant us a worldwide, royalty-free licence to process them solely to provide the service (generation, storage, display back to you).",
          "Subject to your compliance with these terms, you own the AI-generated outputs you create. Note that AI outputs may not be copyrightable in some jurisdictions.",
          "You are responsible for ensuring you have the rights to every reference you upload — including the right to use any person's likeness depicted in a selfie.",
        ],
      },
      {
        heading: "4. Acceptable use",
        body: [
          "You may not use Aurora to generate sexual content involving minors, non-consensual sexual content, content that impersonates a real person without their consent, content that incites violence or hatred, or content that violates any law.",
          "See our Acceptable Use Policy for the full list. Violations may result in immediate termination without refund and reporting to authorities where required.",
        ],
      },
      {
        heading: "5. Credits, payments & refunds",
        body: [
          "Generations consume credits. Credit prices are listed in-app in US dollars. Credits are non-transferable and have no cash value once issued.",
          "See the Refund Policy for details. In short: unused credits purchased within the last 14 days may be refunded on request, minus any credits already consumed.",
        ],
      },
      {
        heading: "6. Disclaimers",
        body: [
          "Aurora is provided \"as is\" and \"as available\" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.",
          "AI outputs may be inaccurate, offensive, or harmful. You are responsible for reviewing outputs before relying on or publishing them.",
        ],
      },
      {
        heading: "7. Limitation of liability",
        body: [
          "To the maximum extent permitted by law, Aurora and its operators will not be liable for any indirect, incidental, consequential, special, or exemplary damages. Our aggregate liability for any claim arising out of or relating to this agreement is limited to the amount you paid Aurora in the 12 months preceding the claim.",
        ],
      },
      {
        heading: "8. Changes",
        body: [
          `We may update these terms from time to time. The current version is dated ${LEGAL_VERSION}. Material changes will be notified by email or in-app banner. Continued use after a change means you accept the new terms.`,
        ],
      },
      {
        heading: "9. Contact",
        body: [`Questions? Email ${COMPANY.email} or use our contact form.`],
      },
    ],
  },

  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    summary:
      "We collect the minimum we need to run Aurora, we never sell your data, and we delete generations and references on request.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Account data — email address, display name, and (if you sign in via a third-party provider) the basic profile information they share.",
          "Uploads — reference photos, audio, and videos you submit. Stored in our private object storage, accessible only to you and our backend.",
          "Generations — prompts, model used, output URLs, credit cost, status. Used to display your gallery and support refunds / debugging.",
          "Payments — handled by Paystack. We store the reference, amount, status and credits granted, never your full card number.",
          "Product analytics — page views, button clicks, generation events, session id. Used to improve the product. We do not track you across third-party sites.",
          "Webhooks — if you register a webhook, we store the URL and delivery logs for debugging.",
        ],
      },
      {
        heading: "Why we collect it",
        body: [
          "To provide the service (generate images and videos, show your gallery, take payments).",
          "To enforce safety and our acceptable-use policy.",
          "To debug failures, monitor provider health, and prevent abuse.",
          "To send transactional emails (receipts, security alerts, generation notifications). We do not send marketing without your explicit consent.",
        ],
      },
      {
        heading: "Who we share it with",
        body: [
          "AI providers — your prompts and reference URLs are sent to the AI model you select (Google Gemini, Replicate, Hugging Face, Sync.so, Inference.net, HeyGen) only to fulfil that generation.",
          "Payment processor — Paystack receives the data required to process payments.",
          "Infrastructure — our hosting and database providers process data on our behalf under data processing agreements.",
          "We never sell your data. We never share it with advertisers.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can export your data, delete any generation, delete your account, or request human review of an automated decision. Contact us and we will respond within 30 days.",
          "Depending on where you live, you may have additional rights under GDPR, UK GDPR, CCPA/CPRA or similar laws.",
        ],
      },
      {
        heading: "Retention",
        body: [
          "Generations and uploads are kept until you delete them or delete your account. Backups roll off within 30 days.",
          "Payment records are retained for 7 years for tax compliance.",
          "Email logs are kept for 90 days then purged.",
        ],
      },
      {
        heading: "Children",
        body: ["Aurora is not directed to children under 13. If we learn a child under 13 has signed up, we will delete the account."],
      },
      {
        heading: "Contact",
        body: [`Privacy questions: ${COMPANY.email}. Last updated: ${LEGAL_VERSION}.`],
      },
    ],
  },

  cookies: {
    slug: "cookies",
    title: "Cookie Policy",
    summary: "We use the bare minimum of cookies / local storage to keep you signed in and to measure product usage.",
    sections: [
      {
        heading: "What we store on your device",
        body: [
          "Authentication tokens — stored in localStorage so you stay signed in across visits. Removed on sign-out.",
          "Session id — a random id we attach to anonymous product-analytics events so we can group them into a session. Not linked to any third party.",
          "UI preferences — small settings like which model you last picked.",
        ],
      },
      {
        heading: "Third-party cookies",
        body: [
          "Aurora does not set marketing or advertising cookies. Payments go through Paystack, which may set its own cookies on their checkout pages.",
        ],
      },
      {
        heading: "How to opt out",
        body: ["Clear your browser storage at any time. This will sign you out and reset preferences."],
      },
    ],
  },

  refunds: {
    slug: "refunds",
    title: "Refund Policy",
    summary: "Unused credits purchased in the last 14 days are refundable. Generations that fail on our side are auto-refunded.",
    sections: [
      {
        heading: "Failed generations",
        body: [
          "If a generation fails because of a provider or platform error, the credits used are automatically refunded to your balance. You don't need to ask.",
        ],
      },
      {
        heading: "Unused credits",
        body: [
          "You can request a refund for unused credits purchased within the last 14 days. Refund amount = (unused credits / purchased credits) × purchase price.",
          "Credits acquired via gift cards or promotions are not refundable for cash but can be re-issued as a new gift card on request.",
        ],
      },
      {
        heading: "How to request",
        body: [
          `Email ${COMPANY.email} from the address on your account with your payment reference. We aim to process refunds within 5 business days.`,
        ],
      },
      {
        heading: "Chargebacks",
        body: [
          "Please contact us before raising a chargeback — most issues can be resolved within 24 hours. Fraudulent chargebacks may result in account termination.",
        ],
      },
    ],
  },

  "acceptable-use": {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    summary:
      "Aurora is a creative tool. These rules exist to keep it safe for everyone and to keep our AI providers willing to serve us.",
    sections: [
      {
        heading: "Never generate",
        body: [
          "Sexual content involving minors — zero tolerance, reported to NCMEC and law enforcement.",
          "Non-consensual intimate imagery (so-called \"deepfake nudes\") of any real person.",
          "Content that impersonates a real, identifiable person without their explicit consent — especially public figures in contexts that could be mistaken for reality.",
          "Content that promotes terrorism, mass violence, self-harm, or illegal activity.",
          "Content that targets people with slurs or hatred based on race, religion, gender, sexuality, disability or national origin.",
        ],
      },
      {
        heading: "Identity & likeness",
        body: [
          "Only upload selfies of yourself, or of people who have given you written permission. If a likeness complaint is filed against you, we may suspend the account pending review.",
        ],
      },
      {
        heading: "Disclosure",
        body: [
          "When you publish Aurora outputs publicly (especially performance / music-video shots), we strongly encourage labelling them as AI-generated.",
        ],
      },
      {
        heading: "Reporting abuse",
        body: [`Email ${COMPANY.email} with a link or screenshot. We review every report within 48 hours.`],
      },
    ],
  },
};
