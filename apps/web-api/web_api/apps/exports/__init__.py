"""Trip export audit feature.

Records that a PDF export occurred for a given trip — mode, sheet count,
denormalized trip route labels, timestamp. No PDF bytes are ever persisted
(architecture invariant #6). The denormalized labels + ``on_delete=SET_NULL``
on the ``trip`` FK ensure history survives trip deletion so the driver can
still browse and Recreate (best-effort) past exports.
"""
