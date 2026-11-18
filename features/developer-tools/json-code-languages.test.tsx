import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { jsonToCode } from "@/features/developer-tools/json-code-utils";

afterEach(cleanup);

const source = '{"id":1,"first_name":"Ada","score":1.5,"tags":["a"],"address":{"city":"London"},"note":null}';

describe("JSON to C#, Kotlin, and Swift", () => {
	it("generates C# records with JSON property names", () => {
		const code = jsonToCode(source, "csharp", "Person");
		expect(code).toContain("using System.Text.Json.Serialization;");
		expect(code).toContain("namespace Models;");
		expect(code).toContain("public sealed record Person(");
		expect(code).toContain('[property: JsonPropertyName("first_name")] string FirstName');
		expect(code).toContain("long Id");
		expect(code).toContain("double Score");
		expect(code).toContain("List<string> Tags");
		expect(code).toContain("public sealed record Address(");
		expect(code).toContain("JsonElement? Note");
	});

	it("generates Kotlin data classes", () => {
		const code = jsonToCode(source, "kotlin", "Person");
		expect(code).toContain("import kotlinx.serialization.Serializable");
		expect(code).toContain("@Serializable");
		expect(code).toContain("data class Person(");
		expect(code).toContain("val first_name: String");
		expect(code).toContain("val id: Long");
		expect(code).toContain("val tags: List<String>");
		expect(code).toContain("val note: JsonElement? = null");
		expect(code).toContain("data class Address(");
	});

	it("generates Swift Codable structs with coding keys", () => {
		const code = jsonToCode(source, "swift", "Person");
		expect(code).toContain("import Foundation");
		expect(code).toContain("struct Person: Codable {");
		expect(code).toContain("let id: Int64");
		expect(code).toContain("let firstName: String");
		expect(code).toContain('case firstName = "first_name"');
		expect(code).toContain("enum CodingKeys: String, CodingKey {");
		expect(code).toContain("let tags: [String]");
		expect(code).toContain("let note: JSONValue?");
		expect(code).toContain("struct Address: Codable {");
	});

	it("emits type aliases for array roots", () => {
		expect(jsonToCode('[{"name":"a"}]', "swift", "Person")).toContain("typealias PersonList = [Person]");
		expect(jsonToCode("[1,2,3]", "kotlin", "Id")).toContain("typealias Id = List<Long>");
		expect(jsonToCode("[1,2,3]", "csharp", "Id")).toContain("public sealed record Id(List<long> Value);");
	});
});
