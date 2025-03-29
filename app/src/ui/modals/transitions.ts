import type { MantineTransition } from "@mantine/core";

export const scaleFadeIn: MantineTransition = {
   in: { opacity: 1, transform: "scale(1)" },
   out: { opacity: 0, transform: "scale(0.9)" },
   transitionProperty: "transform, opacity",
};
