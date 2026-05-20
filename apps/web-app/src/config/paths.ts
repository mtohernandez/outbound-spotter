export const paths = {
  root: "/",
  tripsNew: "/trips/new",
  tripsDetail: (id: string): string => `/trips/${id}`,
} as const;
