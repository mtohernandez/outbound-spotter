// Ephemeral per-trip log-sheet metadata. Lifted to <DailyLogSheetsStrip /> so
// every day in the strip reads the same values (FMCSA paper-log convention:
// same truck on the same trip — per-day repetition is paperwork, not data).
// Persistence lands in spec 10 (driver profile + per-trip overrides).
export interface SheetMetadata {
  truckNumber: string;
  trailerNumber: string;
  carrierName: string;
  mainOfficeAddress: string;
  coDriverName: string;
  shippingDocNumber: string;
  shipperAndCommodity: string;
  iCertify: boolean;
  // When the driver overrides the Clerk-defaulted signature; empty string means
  // "use the Clerk default" (the strip falls back to driverLegalName).
  signatureOverride: string;
}

export function createEmptyMetadata(): SheetMetadata {
  return {
    truckNumber: "",
    trailerNumber: "",
    carrierName: "",
    mainOfficeAddress: "",
    coDriverName: "",
    shippingDocNumber: "",
    shipperAndCommodity: "",
    iCertify: false,
    signatureOverride: "",
  };
}
