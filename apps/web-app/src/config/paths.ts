export const paths = {
  root: "/",
} as const;

export type AppPath = (typeof paths)[keyof typeof paths];
