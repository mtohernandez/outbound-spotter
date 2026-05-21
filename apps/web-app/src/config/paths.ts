export const paths = {
  root: "/",
  tripsNew: "/trips/new",
  tripsHistory: "/trips",
  tripsDetail: (id: string): string => `/trips/${id}`,
  exportsHistory: "/exports",
} as const;
