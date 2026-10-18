// Pluggable mailer. The default implementation only logs the email to the console; replace it
// at startup with an SMTP implementation (e.g. nodemailer) via `setMailer()`.

export type Mail = { to: string; subject: string; text: string; html?: string };

export interface Mailer {
	send(mail: Mail): Promise<void>;
}

export class ConsoleMailer implements Mailer {
	readonly sent: Mail[] = [];

	async send(mail: Mail) {
		this.sent.push(mail);
		if (this.sent.length > 50) this.sent.shift();
		console.info(
			`\n📧 Email (console)\n   A: ${mail.to}\n   Oggetto: ${mail.subject}\n   ---\n${mail.text
				.split('\n')
				.map((l) => `   ${l}`)
				.join('\n')}\n`
		);
	}
}

let current: Mailer = new ConsoleMailer();

export function getMailer(): Mailer {
	return current;
}

export function setMailer(mailer: Mailer) {
	current = mailer;
}
