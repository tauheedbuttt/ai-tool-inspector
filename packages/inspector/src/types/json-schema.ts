/** Minimal structural view of the JSON Schema documents the AI SDK produces. */
export interface JSONSchema7 {
  type?: string | string[];
  properties?: Record<string, JSONSchema7>;
  required?: string[];
  items?: JSONSchema7 | JSONSchema7[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  examples?: unknown[];
  description?: string;
  format?: string;
  anyOf?: JSONSchema7[];
  oneOf?: JSONSchema7[];
  allOf?: JSONSchema7[];
  $ref?: string;
  $defs?: Record<string, JSONSchema7>;
  definitions?: Record<string, JSONSchema7>;
  additionalProperties?: boolean | JSONSchema7;
  [key: string]: unknown;
}
