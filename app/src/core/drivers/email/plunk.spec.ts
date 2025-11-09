import { describe, it, expect } from "bun:test";
import { plunkEmail } from "./plunk";

const ALL_TESTS = !!process.env.ALL_TESTS;

describe.skipIf(ALL_TESTS)("plunk", () => {
	it("should throw on failed", async () => {
		const driver = plunkEmail({ apiKey: "invalid" });
		expect(driver.send("foo@bar.com", "Test", "Test")).rejects.toThrow();
	});

	it("should send an email", async () => {
		const driver = plunkEmail({
			apiKey: process.env.PLUNK_API_KEY!,
			from: undefined, // Default to what Plunk sets
		});
		const response = await driver.send(
			"help@bknd.io",
			"Test Email from Plunk",
			"This is a test email",
		);
		expect(response).toBeDefined();
		expect(response.success).toBe(true);
		expect(response.emails).toBeDefined();
		expect(response.timestamp).toBeDefined();
	});

	it("should send HTML email", async () => {
		const driver = plunkEmail({
			apiKey: process.env.PLUNK_API_KEY!,
			from: undefined,
		});
		const htmlBody = "<h1>Test Email</h1><p>This is a test email</p>";
		const response = await driver.send(
			"help@bknd.io",
			"HTML Test",
			htmlBody,
		);
		expect(response).toBeDefined();
		expect(response.success).toBe(true);
	});

	it("should send with text and html", async () => {
		const driver = plunkEmail({
			apiKey: process.env.PLUNK_API_KEY!,
			from: undefined,
		});
		const response = await driver.send("test@example.com", "Test Email", {
			text: "help@bknd.io",
			html: "<p>This is HTML</p>",
		});
		expect(response).toBeDefined();
		expect(response.success).toBe(true);
	});

	it("should send to multiple recipients", async () => {
		const driver = plunkEmail({
			apiKey: process.env.PLUNK_API_KEY!,
			from: undefined,
		});
		const response = await driver.send(
			"help@bknd.io",
			"Multi-recipient Test",
			"Test email to multiple recipients",
			{
				to: ["help@bknd.io", "cameronandrewpak@gmail.com"],
			},
		);
		expect(response).toBeDefined();
		expect(response.success).toBe(true);
		expect(response.emails).toHaveLength(2);
	});

	it("should throw error for more than 5 recipients", async () => {
		const driver = plunkEmail({
			apiKey: process.env.PLUNK_API_KEY!,
			from: undefined,
		});
		expect(
			driver.send("help@bknd.io", "Test", "Test", {
				to: [
					"help@bknd.io",
					"test2@example.com",
					"test3@example.com",
					"test4@example.com",
					"test5@example.com",
					"test6@example.com",
				],
			}),
		).rejects.toThrow("Plunk supports a maximum of 5 recipients per email");
	});
});
