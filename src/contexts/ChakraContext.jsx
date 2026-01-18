import React from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

// You can customize the Chakra theme here if needed
// In Chakra UI v3, theming is done through CSS custom properties or the new system
const system = defaultSystem;

export function BiensperienceChakraProvider({ children }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}
