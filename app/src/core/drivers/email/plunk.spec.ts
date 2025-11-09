import { describe, it, expect } from "bun:test";
import { plunkEmail } from "./plunk";

const ALL_TESTS = !!process.env.ALL_TESTS;

describe.skipIf(ALL_TESTS)("plunk", () => {
	it.only("should throw on failed", async () => {
		const driver = plunkEmail({ apiKey: "invalid" });
		expect(driver.send("foo@bar.com", "Test", "Test")).rejects.toThrow();
	});

	it("should send an email", async () => {
		const driver = plunkEmail({
			apiKey: process.env.PLUNK_API_KEY!,
			from: "test@example.com",
		});
		const response = await driver.send(
			"test@example.com",
			"Test Email",
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
			from: "test@example.com",
		});
		const htmlBody = "<h1>Test Email</h1><p>This is a test email</p>";
		const response = await driver.send(
			"test@example.com",
			"HTML Test",
			htmlBody,
		);
		expect(response).toBeDefined();
		expect(response.success).toBe(true);
	});

	it("should send with text and html", async () => {
		const driver = plunkEmail({
			apiKey: process.env.PLUNK_API_KEY!,
			from: "test@example.com",
		});
		const response = await driver.send("test@example.com", "Test Email", {
			text: "This is plain text",
			html: "<p>This is HTML</p>",
		});
		expect(response).toBeDefined();
		expect(response.success).toBe(true);
	});

	it("should send to multiple recipients", async () => {
		const driver = plunkEmail({
			apiKey: process.env.PLUNK_API_KEY!,
			from: "test@example.com",
		});
		const response = await driver.send(
			"test@example.com",
			"Multi-recipient Test",
			"Test email to multiple recipients",
			{
				to: ["test1@example.com", "test2@example.com"],
			},
		);
		expect(response).toBeDefined();
		expect(response.success).toBe(true);
		expect(response.emails).toHaveLength(2);
	});

	it("should throw error for more than 5 recipients", async () => {
		const driver = plunkEmail({
			apiKey: process.env.PLUNK_API_KEY!,
			from: "test@example.com",
		});
		expect(
			driver.send("test@example.com", "Test", "Test", {
				to: [
					"test1@example.com",
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
