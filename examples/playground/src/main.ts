import { createToolInspector } from "ai-tool-inspector";
import { tools } from "./tools";

createToolInspector({
  tools,
  port: 4984,
  enabled: process.env.NODE_ENV !== "production",
});
