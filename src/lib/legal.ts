// Data shown in the privacy policy (/privacy). Fill in the fields marked TODO before going
// public: the policy is incomplete (and not GDPR compliant) without the data controller.

export const LEGAL = {
	/** Who runs Splitto: full name (or company name) and, for a company, address and VAT number. */
	controller: 'TODO: nome e cognome (o ragione sociale) del titolare',
	/** Address people can write to for privacy requests. */
	contactEmail: 'TODO: email per le richieste privacy',
	/** Company that hosts the server, and where (e.g. "Hetzner Online GmbH, Germania (UE)"). */
	hosting: 'TODO: fornitore del server e paese',
	/** Email provider used for service emails (password reset); null while none is configured. */
	emailProvider: null as string | null,
	/** Date of the last change to the policy (YYYY-MM-DD). */
	updatedAt: '2026-10-19'
} as const;
