import { Tooltip, TooltipContent, TooltipTrigger } from "@outbound/ui/components/ui/tooltip";

import { EditableLine } from "@/features/log-sheet/components/editable-line";
import { SignatureField } from "@/features/log-sheet/components/signature-field";
import type { SheetMetadata } from "@/features/log-sheet/types/sheet-metadata";

interface LogSheetFooterProps {
  readonly idPrefix: string;
  readonly driverLegalName: string;
  readonly metadata: SheetMetadata;
  readonly onMetadataChange: (next: SheetMetadata) => void;
}

// Block under the SVG grid: Shipping Documents + I-certify signature + the
// FMCSA literal "Use time standard of home terminal." + faded recap pointer
// to the app summary. Spec 08 decision 15 — the manual recap math is omitted
// (the planner enforces §395.3 server-side; mirroring the math would create
// a duplicate-source-of-truth risk).
export function LogSheetFooter({
  idPrefix,
  driverLegalName,
  metadata,
  onMetadataChange,
}: LogSheetFooterProps): React.ReactElement {
  return (
    <footer className="border-foreground/30 text-foreground border-t px-4 pt-4 pb-5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2">
        <section>
          <h3 className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase">
            Shipping Documents
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
                Pro or Shipping No.
              </p>
              <EditableLine
                id={`${idPrefix}-shipping-doc`}
                label="Pro or Shipping number"
                value={metadata.shippingDocNumber}
                placeholder="e.g. PRO-100123"
                onChange={(next) => {
                  onMetadataChange({ ...metadata, shippingDocNumber: next });
                }}
              />
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-[10px] tracking-wider uppercase">
                Shipper &amp; Commodity
              </p>
              <EditableLine
                id={`${idPrefix}-shipper-commodity`}
                label="Shipper and commodity"
                value={metadata.shipperAndCommodity}
                placeholder="e.g. Acme Inc. — palletized goods"
                onChange={(next) => {
                  onMetadataChange({ ...metadata, shipperAndCommodity: next });
                }}
              />
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-[10px] tracking-wider uppercase">
            Use time standard of home terminal.
          </p>
        </section>

        <section>
          <SignatureField
            idPrefix={idPrefix}
            driverLegalName={driverLegalName}
            signatureOverride={metadata.signatureOverride}
            iCertify={metadata.iCertify}
            onCertifyChange={(next) => {
              onMetadataChange({ ...metadata, iCertify: next });
            }}
            onSignatureOverrideChange={(next) => {
              onMetadataChange({ ...metadata, signatureOverride: next });
            }}
          />
        </section>
      </div>

      <div className="border-foreground/20 mt-4 border-t border-dashed pt-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground/70 focus-visible:ring-ring focus-visible:ring-offset-background cursor-help rounded-sm text-[10px] tracking-wider uppercase underline-offset-2 hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Recap (70/8 &amp; 60/7) — see app summary
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-xs">
            The planner enforces §395.3 cycle limits server-side. The manual recap math is omitted
            here to avoid drift between two sources of truth.
          </TooltipContent>
        </Tooltip>
      </div>
    </footer>
  );
}
