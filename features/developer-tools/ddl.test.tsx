import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ddlToMongoose, ddlToPrisma, ddlToTypeScript, parseDdl } from "@/features/developer-tools/ddl-utils";
import { DdlTool } from "@/features/developer-tools/ddl-tool";

afterEach(cleanup);

const ddl = `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);`;

describe("SQL DDL to models", () => {
	it("parses columns, keys, and defaults", () => {
		const [table] = parseDdl(ddl);
		expect(table.name).toBe("users");
		expect(table.columns.map((column) => column.name)).toEqual(["id", "email", "name", "role", "is_active", "created_at"]);
		const email = table.columns[1];
		expect(email.kind).toBe("string");
		expect(email.nullable).toBe(false);
		expect(email.unique).toBe(true);
		expect(table.columns[0].primaryKey).toBe(true);
		expect(table.columns[0].autoIncrement).toBe(true);
		expect(table.columns[3].defaultValue).toBe("'member'");
		expect(table.columns[5].kind).toBe("date");
	});

	it("detects composite keys and foreign keys", () => {
		const [table] = parseDdl(`CREATE TABLE memberships (
			user_id BIGINT NOT NULL REFERENCES users(id),
			org_id BIGINT NOT NULL,
			role TEXT,
			PRIMARY KEY (user_id, org_id)
		);`);
		expect(table.compositePrimaryKey).toEqual(["user_id", "org_id"]);
		expect(table.columns[0].references).toEqual({ table: "users", column: "id" });
		expect(table.columns.filter((column) => column.primaryKey).map((column) => column.name)).toEqual(["user_id", "org_id"]);
		expect(table.columns[2].primaryKey).toBe(false);
	});

	it("skips comments and quoted identifiers", () => {
		const tables = parseDdl('-- user table\nCREATE TABLE "public"."accounts" (\n  `id` INT PRIMARY KEY,\n  "full name" TEXT\n);');
		expect(tables[0].name).toBe("accounts");
		expect(tables[0].columns.map((column) => column.name)).toEqual(["id", "full name"]);
	});

	it("emits Prisma models with defaults and maps", () => {
		const prisma = ddlToPrisma(parseDdl(ddl));
		expect(prisma).toContain("model Users {");
		expect(prisma).toContain("id Int @id @default(autoincrement())");
		expect(prisma).toContain("email String @unique");
		expect(prisma).toContain("name String?");
		expect(prisma).toContain('role String @default("member")');
		expect(prisma).toContain("is_active Boolean? @default(true)");
		expect(prisma).toContain("created_at DateTime @default(now())");
		const uuidKey = ddlToPrisma(parseDdl("CREATE TABLE posts (id UUID PRIMARY KEY, title TEXT NOT NULL);"));
		expect(uuidKey).toContain("id String @id @default(uuid())");
	});

	it("emits TypeScript interfaces and Mongoose schemas", () => {
		const tables = parseDdl(ddl);
		const ts = ddlToTypeScript(tables);
		expect(ts).toContain("export interface Users {");
		expect(ts).toContain("email: string;");
		expect(ts).toContain("name?: string | null;");
		expect(ts).toContain("/** primary key */");
		const mongoose = ddlToMongoose(tables);
		expect(mongoose).toContain("const UsersSchema = new Schema({");
		expect(mongoose).toContain("email: { type: String, required: true, unique: true }");
		expect(mongoose).toContain('role: { type: String, required: true, default: "member" }');
	});

	it("rejects unusable SQL", () => {
		expect(() => parseDdl("  ")).toThrow(/Paste CREATE TABLE/u);
		expect(() => parseDdl("SELECT * FROM users;")).toThrow(/Only CREATE TABLE/u);
		expect(() => parseDdl("CREATE INDEX idx ON users (id);")).toThrow(/Only CREATE TABLE/u);
		expect(() => parseDdl("CREATE TABLE empty ();")).toThrow(/No columns found/u);
	});

	it("renders and switches targets", async () => {
		const user = userEvent.setup();
		render(<DdlTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("model Users {");
		await user.selectOptions(screen.getByLabelText("Output"), "typescript");
		expect(output()).toContain("export interface Posts {");
		fireEvent.change(screen.getByLabelText("CREATE TABLE statements"), { target: { value: "nope" } });
		expect(screen.getByRole("alert").textContent).toContain("Only CREATE TABLE");
	});
});
