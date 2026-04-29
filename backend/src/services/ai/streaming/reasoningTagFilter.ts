export function createThinkTagFilter() {
  let buffer = "";
  let isInsideThinkBlock = false;
  const maxTagLength = "</think>".length;

  return {
    push(chunk: string) {
      buffer += chunk;
      let output = "";

      while (buffer.length > 0) {
        const lowerBuffer = buffer.toLowerCase();

        if (isInsideThinkBlock) {
          const closeIndex = lowerBuffer.indexOf("</think>");
          if (closeIndex === -1) {
            buffer = buffer.slice(
              Math.max(0, buffer.length - maxTagLength + 1),
            );
            break;
          }

          buffer = buffer.slice(closeIndex + "</think>".length);
          isInsideThinkBlock = false;
          continue;
        }

        const openIndex = lowerBuffer.indexOf("<think>");
        if (openIndex === -1) {
          const emitLength = Math.max(0, buffer.length - maxTagLength + 1);
          output += buffer.slice(0, emitLength);
          buffer = buffer.slice(emitLength);
          break;
        }

        output += buffer.slice(0, openIndex);
        buffer = buffer.slice(openIndex + "<think>".length);
        isInsideThinkBlock = true;
      }

      return output;
    },
    flush() {
      if (isInsideThinkBlock) {
        buffer = "";
        return "";
      }

      const output = buffer;
      buffer = "";
      return output;
    },
  };
}

