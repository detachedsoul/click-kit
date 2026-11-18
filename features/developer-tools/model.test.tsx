import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { inferFields, parseModel, toMongoose, toPrisma } from "@/features/developer-tools/model-utils";
import { ModelTool } from "@/features/developer-tools/model-tool";

afterEach(cleanup);

const sample = '{"name":"Ada","age":36,"score":12.5,"active":true,"joinedAt":"2024-03-01T09:30:00Z","deletedAt":null,"tags":["a","b"],"address":{"city":"London"},"prefs":{"theme":"dark"}}';

describe("JSON to Mongoose and Prisma models", () => {
	it("infers scalar, date, array, and nested types", () => {
		const fields = inferFields([JSON.parse(sample) as Record<string, unknown>]);
		const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));
		expect(byKey.name.kind).toBe("string");
		expect(byKey.age.kind).toBe("int");
		expect(byKey.score.kind).toBe("float");
		expect(byKey.joinedAt.kind).toBe("date");
		expect(byKey.deletedAt.optional).toBe(true);
		expect(byKey.tags.kind).toBe("array");
		expect(byKey.tags.itemKind).toBe("string");
		expect(byKey.address.kind).toBe("object");
		expect(byKey.address.children?.[0].key).toBe("city");
	});

	it("marks keys missing from some records as optional and merges mixed types", () => {
		const fields = inferFields([{ a: 1, b: "x" }, { a: 2.5, c: true }]);
		const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));
		expect(byKey.a.kind).toBe("float");
		expect(byKey.b.optional).toBe(true);
		expect(byKey.c.optional).toBe(true);
		expect(inferFields([{ value: 1 }, { value: "one" }])[0].kind).toBe("mixed");
	});

	it("generates a Mongoose schema", () => {
		const model = parseModel(sample, "User");
		const code = toMongoose(model, { timestamps: true, strictMode: true });
		expect(code).toContain('import mongoose from "mongoose";');
		expect(code).toContain("const UserSchema = new Schema(");
		expect(code).toContain("name: { type: String, required: true }");
		expect(code).toContain("age: { type: Number, required: true }");
		expect(code).toContain("joinedAt: { type: Date, required: true }");
		expect(code).toContain("tags: { type: [String], required: true }");
		expect(code).toContain("address: new Schema({");
		expect(code).toContain("deletedAt: Schema.Types.Mixed");
		expect(code).toContain("{ timestamps: true }");
		expect(code).toContain("export const User = mongoose.model(\"User\", UserSchema);");
		expect(toMongoose(model, { timestamps: false, strictMode: false })).toContain("{ strict: false }");
	});

	it("generates a Prisma model", () => {
		const model = parseModel(sample, "User");
		const prisma = toPrisma(model, { idField: true, nullableOptional: true, mapTo: "users" });
		expect(prisma).toContain("model User {");
		expect(prisma).toMatch(/id\s+String\s+@id @default\(uuid\(\)\)/u);
		expect(prisma).toContain("age");
		expect(prisma).toContain("Int");
		expect(prisma).toContain("score");
		expect(prisma).toContain("Float");
		expect(prisma).toContain("joinedAt");
		expect(prisma).toContain("DateTime");
		expect(prisma).toContain("String[]");
		expect(prisma).toContain("deletedAt");
		expect(prisma).toContain("Json?");
		expect(prisma).toContain('@@map("users")');
		expect(toPrisma(model, { idField: false, nullableOptional: false, mapTo: "" })).not.toContain("@id");
	});

	it("validates input", () => {
		expect(() => parseModel("   ", "User")).toThrow(/Paste sample JSON/u);
		expect(() => parseModel("{oops", "User")).toThrow(/Unexpected|Expected/u);
		expect(() => parseModel("[1,2]", "User")).toThrow(/Expected a JSON object/u);
		expect(() => parseModel('{"a":1}', "9 bad")).toThrow(/not a valid model name/u);
	});

	it("renders both targets and reacts to options", async () => {
		const user = userEvent.setup();
		render(<ModelTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("const UserSchema = new Schema(");
		await user.selectOptions(screen.getByLabelText("Output"), "prisma");
		expect(output()).toContain("model User {");
		expect(output()).toMatch(/id\s+String\s+@id\b/u);
		fireEvent.change(screen.getByLabelText("Model name"), { target: { value: "Member" } });
		expect(output()).toContain("model Member {");
		fireEvent.change(screen.getByLabelText("Sample JSON"), { target: { value: "[]" } });
		expect(screen.getByText(/Expected a JSON object|Expected at least one/u)).toBeTruthy();
	});
});
