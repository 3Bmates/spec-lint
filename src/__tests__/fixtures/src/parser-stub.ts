// Fixture source: implements ParsedSpec and parseSpecs
// Does NOT implement NonExistentType or nonExistentFunction

export interface InterfaceSpec {
  name: string;
  methods: string[];
  file: string;
  line: number;
}

export interface TypeSpec {
  name: string;
  definition: string;
  file: string;
  line: number;
}

export interface FunctionSpec {
  name: string;
  signature: string;
  file: string;
  line: number;
}

export interface ParsedSpec {
  interfaces: InterfaceSpec[];
  types: TypeSpec[];
  functions: FunctionSpec[];
}

export function parseSpecs(_filePaths: string[]): ParsedSpec {
  return { interfaces: [], types: [], functions: [] };
}

// Type alias matching the spec
export type ParsedSpecAlias = ParsedSpec;
