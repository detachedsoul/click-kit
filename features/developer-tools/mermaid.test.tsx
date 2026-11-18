import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { jsonToErd, toPascal } from "@/features/developer-tools/mermaid-utils";
import MermaidTool from "@/features/developer-tools/mermaid-tool";

afterEach(cleanup);

const schema = JSON.stringify({
	users: [
		{
			id: 1,
			name: "Ada",
			created_at: "2024-01-02T09:30:00Z",
			address: { city: "Lagos", country: "NG" },
			posts: [{ id: 10, title: "Hello", published: true, score: 4.5 }],
		},
	],
	tags: ["maths", "history"],
});

describe("JSON to Mermaid ER diagram", () => {
	it("builds entities, fields, and relations", () => {
		const { mermaid, entityCount, relations } = jsonToErd(schema);
		expect(entityCount).toBe(4);
		expect(mermaid.startsWith("erDiagram\n")).toBe(true);
		expect(mermaid).toContain("  User {\n    int id\n    string name\n    date created_at\n    int address_id");
		expect(mermaid).toContain("  Post {\n    int user_id\n    int id\n    string title\n    boolean published\n    float score");
		expect(mermaid).toContain('User ||--|| Address : "address"');
		expect(mermaid).toContain('User ||--o{ Post : "posts"');
		expect(relations.map((relation) => relation.label)).toEqual(["address", "posts"]);
	});

	it("keeps primitive arrays as a field and handles bare arrays", () => {
		expect(jsonToErd('{"tags":["a","b"]}').mermaid).toContain("Record {\n    string tags");
		const list = jsonToErd('[{"id":1,"label":"x"},{"id":2,"label":"y"}]');
		expect(list.entityCount).toBe(1);
		expect(list.mermaid).toContain("Record {\n    int id\n    string label");
	});

	it("singularises and names entities sensibly", () => {
		expect(toPascal("blog_posts")).toBe("BlogPosts");
		expect(jsonToErd('{"blog_posts":[{"id":1}]}').mermaid).toContain("BlogPost {");
		expect(jsonToErd('{"categories":[{"id":1}]}').mermaid).toContain("Category {");
		expect(jsonToErd('{"addresses":[{"id":1}]}').mermaid).toContain("Address {");
	});

	it("reports bad input", () => {
		expect(() => jsonToErd("")).toThrow(/Paste some JSON/u);
		expect(() => jsonToErd("{oops}")).toThrow(/not valid JSON/u);
		expect(() => jsonToErd("42")).toThrow(/JSON object or an array/u);
		expect(() => jsonToErd("[1,2,3]")).toThrow(/must contain objects/u);
		expect(() => jsonToErd("{}")).toThrow(/nothing to draw/u);
	});

	it("renders the diagram and toggles relations", async () => {
		const user = userEvent.setup();
		render(<MermaidTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("User ||--o{ Post");
		await user.click(screen.getByLabelText("Include relationship lines"));
		expect(output()).not.toContain("User ||--o{ Post");
		expect(output()).toContain("User {");
	});
});
