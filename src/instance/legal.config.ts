import { siteConfig } from "@/config/site.config";

export interface ConfiguredLegalSection {
  title: string;
  body?: string[];
  items?: string[];
}

export interface ConfiguredLegalPage {
  eyebrow: string;
  title: string;
  metadataTitle: string;
  metadataDescription: string;
  intro: string;
  sections: ConfiguredLegalSection[];
}

const siteName = siteConfig.name;
const contactEmail = siteConfig.contactEmail;

export const legalConfig = {
  identity: {
    siteName,
    contactEmail,
    operatorName: siteConfig.operator.name,
    operatorCountry: siteConfig.operator.country,
    legalStatus: siteConfig.operator.legalStatus,
  },
  pages: {
    about: {
      eyebrow: "About Budget Travel Compass",
      title: "Travel smarter. Go further.",
      metadataTitle: "About Budget Travel Compass",
      metadataDescription: `Learn how ${siteName} approaches affordable independent travel, research, and editorial independence.`,
      intro: `${siteName} is an independent editorial travel resource for people who want to plan realistic budgets, understand trade-offs, and spend intentionally on what matters.`,
      sections: [
        {
          title: `What ${siteName} Is`,
          body: [
            `${siteName} is an independent editorial travel website. We publish practical guidance to help readers compare options and make informed travel-planning decisions.`,
            "We are not a travel agency, booking platform, tour operator, or financial adviser.",
          ],
        },
        {
          title: "Who It Is For",
          body: [
            "Our guides are designed for independent travelers, including younger and first-time international travelers, solo travelers, couples, and friends who want to manage costs thoughtfully without reducing every decision to the lowest price.",
          ],
        },
        {
          title: "Our Approach to Budget Travel",
          body: [
            "Affordable travel is not simply about choosing the cheapest option. It is about spending intentionally on what matters.",
            "A better location, a more practical departure time, or equipment that fits the trip may deliver more value than the lowest advertised price. We help readers consider price alongside convenience, reliability, and experience.",
          ],
        },
        {
          title: "What We Cover",
          items: ["Inspiration", "Trip Planning", "Flights & Stays", "Budget Tips", "Packing & Gear", "Travel Styles"],
        },
        {
          title: "How We Create Our Guides",
          body: [
            "Our guides may draw on research, comparison, editorial review, publicly available information, and practical travel-planning principles.",
            "We do not claim that every destination, service, or product has been personally visited or tested. When a guide includes first-hand experience, that context should be made clear in the guide itself.",
          ],
        },
        {
          title: "Editorial Independence",
          body: [
            "Our goal is to help readers understand their choices and the trade-offs behind them. If commercial relationships are introduced in the future, they should not determine our editorial conclusions and will be disclosed where relevant.",
          ],
        },
      ],
    },
    contact: {
      metadataTitle: "Contact Budget Travel Compass",
      metadataDescription: `Contact ${siteName} with questions, feedback, corrections, copyright concerns, or partnership enquiries.`,
      eyebrow: "Contact",
      title: "Get in touch",
      intro: `Contact ${siteName} about general questions, editorial feedback, corrections, content concerns, copyright issues, or partnership enquiries.`,
      sections: [],
      contactPanels: ["General questions", "Editorial feedback", "Corrections", "Content concerns", "Copyright issues", "Partnership enquiries"],
      responseTime: "No specific response time is promised. Messages are reviewed as availability allows.",
      operatorLine: `Editorial identity: ${siteConfig.editorialTeamName}.`,
    },
    privacy: {
      eyebrow: "Privacy Policy",
      title: "Privacy Policy",
      metadataTitle: "Privacy Policy",
      metadataDescription: `Privacy Policy for ${siteName}.`,
      intro: `This policy describes the limited information that may be processed when readers visit or voluntarily contact ${siteName}.`,
      sections: [
        {
          title: "Information That May Be Processed",
          items: [
            "Basic server and hosting logs needed to deliver pages, diagnose faults, and protect the site.",
            "Contact details and message content that a reader voluntarily sends by email.",
            "Essential technical information required for security, legal compliance, and reliable site operation.",
          ],
        },
        {
          title: "How Information May Be Used",
          items: [
            "To operate, secure, and troubleshoot the website.",
            "To review and respond to editorial, privacy, copyright, or partnership messages.",
            "To comply with applicable legal obligations and protect the site from abuse.",
          ],
        },
        {
          title: "Services Not Currently Enabled",
          body: [
            "Google Analytics, GA4, Google advertising, AdSense, newsletter submissions, and affiliate tracking are not enabled on the public website in this baseline configuration.",
          ],
        },
        {
          title: "Data Sharing and Retention",
          body: [
            "We do not describe or claim data-sharing relationships that are not currently configured. Information is kept only as reasonably needed for the purpose for which it was supplied, security, or legal compliance.",
          ],
        },
        {
          title: "Your Choices",
          body: [
            `Questions about information voluntarily supplied to ${siteName} may be sent to ${contactEmail}. Requests are considered in light of applicable law and the information available to identify the request.`,
          ],
        },
        { title: "Contact", body: [`Privacy enquiries: ${contactEmail}`] },
      ],
    },
    terms: {
      eyebrow: "Terms of Service",
      title: "Terms of Service",
      metadataTitle: "Terms of Service",
      metadataDescription: `Terms governing use of ${siteName}.`,
      intro: `${siteName} provides independent editorial travel information. These terms explain the basis on which readers may use the website.`,
      sections: [
        {
          title: "Informational Purpose",
          body: [
            "Content is provided for general informational and educational purposes. It is not a booking service and does not create an advisory, agency, or client relationship.",
          ],
        },
        {
          title: "No Booking Relationship",
          body: [
            `${siteName} is not an airline, hotel, travel agency, tour operator, or booking provider. Any transaction with a third party is governed by that third party's own terms and policies.`,
          ],
        },
        {
          title: "Changing Travel Information",
          body: [
            "Prices, availability, schedules, baggage rules, visa requirements, and destination entry requirements can change. Readers should verify important details with the relevant official provider or authority before paying, booking, or traveling.",
          ],
        },
        {
          title: "Acceptable Use",
          body: [
            "Readers may use the website lawfully for personal information and planning. Attempts to disrupt the site, misuse its content, interfere with security, or infringe the rights of others are not permitted.",
          ],
        },
        {
          title: "Intellectual Property",
          body: [
            `Original ${siteName} text, presentation, and site materials are protected by applicable intellectual property laws unless stated otherwise. Third-party names and marks remain the property of their respective owners.`,
          ],
        },
        {
          title: "Third-party Links",
          body: [
            "Links to external sites are provided for convenience or reference. We do not control their availability, accuracy, security, prices, or privacy practices.",
          ],
        },
        {
          title: "Availability and Limitations",
          body: [
            "We aim to keep the site useful but do not promise uninterrupted access or that every item will remain complete, current, or error-free. To the extent permitted by applicable law, responsibility for losses arising from reliance on changing third-party travel information is limited.",
          ],
        },
        {
          title: "Changes and Contact",
          body: [
            `Content and these terms may be updated when the website or applicable requirements change. Legal notices may be sent to ${contactEmail}. No governing jurisdiction is stated until a formal operator and jurisdiction are established.`,
          ],
        },
      ],
    },
    cookie: {
      eyebrow: "Cookie Policy",
      title: "Cookie Policy",
      metadataTitle: "Cookie Policy",
      metadataDescription: `Cookie Policy for ${siteName}.`,
      intro: `This policy explains the limited cookie and session behavior that may apply to ${siteName}.`,
      sections: [
        {
          title: "Public Website",
          body: [
            "The public website does not currently use non-essential analytics, advertising, or personalization cookies. Google Analytics and advertising services are not enabled.",
          ],
        },
        {
          title: "Essential Technical Functions",
          body: [
            "Essential technical storage may be used when required for security, reliable page delivery, or another function requested by the visitor. These functions are not used for advertising profiles.",
          ],
        },
        {
          title: "Administrative Sessions",
          body: [
            "Restricted administration areas may use authentication or session cookies. These administrative functions are separate from ordinary public browsing.",
          ],
        },
        {
          title: "Browser Controls and Future Changes",
          body: [
            "Browsers provide controls for viewing, limiting, or deleting stored data. This policy will be updated before optional analytics, advertising, or similar services are enabled.",
          ],
        },
      ],
    },
    editorial: {
      eyebrow: "Editorial Policy",
      title: "Editorial Policy",
      metadataTitle: "Editorial Policy",
      metadataDescription: `Editorial standards and sourcing principles for ${siteName}.`,
      intro: `${siteName} aims to help readers make clearer travel-planning decisions through useful, transparent, and independent editorial guidance.`,
      sections: [
        {
          title: "Our Purpose",
          body: [
            "We explain options, practical constraints, and trade-offs so readers can make decisions that fit their budgets and priorities.",
          ],
        },
        {
          title: "Research and Sourcing",
          body: [
            "For airline policies, baggage rules, visa and entry requirements, transport schedules, accommodation policies, travel costs, insurance, and safety information, we prioritize official or otherwise reliable sources appropriate to the topic.",
            "Guides may also use comparison, editorial review, publicly available information, and practical travel-planning principles. Sources are selected for relevance and reliability, not to imply first-hand experience where none is established.",
          ],
        },
        {
          title: "Accuracy",
          body: [
            "We work to make information accurate at publication, but travel information changes. Readers should confirm consequential details with official sources before purchasing, booking, or departing.",
          ],
        },
        {
          title: "Updates",
          body: [
            "Articles may be revised in response to policy, price, or service changes, or to substantiated reader corrections. We do not promise a fixed update schedule.",
          ],
        },
        {
          title: "Editorial Independence",
          body: [
            "Editorial conclusions should be based on reader value and the evidence considered. Future commercial relationships should not determine those conclusions and will be disclosed where relevant.",
          ],
        },
        {
          title: "Corrections",
          body: [
            `Substantive errors may be corrected or clarified after review. Readers can report a concern to ${contactEmail}. We do not claim to maintain a separate public corrections database.`,
          ],
        },
        {
          title: "Tools",
          body: [
            "Editorial work may involve research, drafting, editing, organization, or formatting tools. Regardless of tooling, published material should be reviewed for clarity, relevance, and support. We do not characterize all content as entirely human-written or entirely machine-generated.",
          ],
        },
      ],
    },
    affiliate: {
      eyebrow: "Affiliate Disclosure",
      title: "Affiliate Disclosure",
      metadataTitle: "Affiliate Disclosure",
      metadataDescription: `Current affiliate status and future disclosure approach for ${siteName}.`,
      intro: `${siteName} does not currently operate a confirmed affiliate program or publish confirmed active affiliate links.`,
      sections: [
        {
          title: "Current Status",
          body: [
            "No affiliate program is active in this baseline configuration, and we do not claim to receive commissions from bookings, purchases, or named travel partners.",
          ],
        },
        {
          title: "Possible Future Relationships",
          body: [
            "The site may use affiliate relationships in the future. Before or when such links are introduced, this policy and relevant content will be updated with clear disclosures.",
          ],
        },
        {
          title: "Editorial Independence",
          body: [
            "A future commission or commercial relationship should not be the sole basis for an editorial recommendation or conclusion.",
          ],
        },
        { title: "Questions", body: [`Questions about commercial disclosures may be sent to ${contactEmail}.`] },
      ],
    },
    dmca: {
      eyebrow: "DMCA / Copyright",
      title: "DMCA / Copyright",
      metadataTitle: "DMCA / Copyright",
      metadataDescription: `Copyright information and concern-reporting process for ${siteName}.`,
      intro: `${siteName} respects intellectual property rights and reviews sufficiently detailed copyright concerns.`,
      sections: [
        {
          title: "Site Content",
          body: [
            `Original text, presentation, and materials published by ${siteName} may not be reproduced, republished, or distributed beyond applicable legal permissions without authorization.`,
          ],
        },
        {
          title: "Reporting a Copyright Concern",
          body: [
            `Send copyright concerns to ${contactEmail}. Include enough information for the material and the claimed right to be assessed.`,
          ],
        },
        {
          title: "Information to Include",
          items: [
            "The name and contact details of the rights holder or authorized representative.",
            "A description of the copyrighted work.",
            `The exact ${siteName} URL or location of the material at issue.`,
            "An explanation of why the use is believed to be unauthorized.",
            "A statement that the supplied information is accurate and submitted in good faith.",
            "A physical or electronic signature of the rights holder or authorized representative.",
          ],
        },
        {
          title: "Review and Follow-up",
          body: [
            "A complete request may be reviewed and clarification may be requested. Appropriate action depends on the information supplied and applicable law. No office address, legal entity, or governing jurisdiction is claimed beyond what has been formally configured.",
          ],
        },
      ],
    },
    disclaimer: {
      eyebrow: "Disclaimer",
      title: "Disclaimer",
      metadataTitle: "Disclaimer",
      metadataDescription: `Travel information disclaimer for ${siteName}.`,
      intro: `${siteName} publishes general informational and educational travel content. Travel conditions and requirements can change.`,
      sections: [
        {
          title: "General Information",
          body: [
            "Content is intended to support research and planning. It is not individualized legal, financial, medical, insurance, safety, immigration, or other professional advice.",
          ],
        },
        {
          title: "Verify Important Decisions",
          body: [
            "Before booking or traveling, readers should check prices, availability, schedules, visa and entry requirements, health and safety guidance, and insurance terms with the relevant official provider, authority, or qualified professional.",
          ],
        },
        {
          title: "Individual Circumstances",
          body: [
            "Travel decisions depend on personal circumstances, risk tolerance, health, documentation, finances, and destination conditions. Readers remain responsible for deciding what information and services are appropriate for them.",
          ],
        },
        {
          title: "External Resources",
          body: [
            "External resources may change without notice. A link does not guarantee the accuracy, availability, or suitability of the linked service.",
          ],
        },
        { title: "Contact", body: [`Questions about this disclaimer may be sent to ${contactEmail}.`] },
      ],
    },
  },
} as const;
