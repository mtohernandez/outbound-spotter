"""Drop ``Trip.status`` and ``Trip.route_error_code``.

Senior-review directive (post-live-smoke): ``TripCreateView`` now validates
the route via ORS BEFORE persisting any row, and propagates routing failures
as HTTP error responses. A persisted Trip therefore implies a successful
route, so ``status`` (now single-valued) and ``route_error_code`` (only
populated on the now-impossible FAILED state) are unreachable.

The forward path also deletes any orphan rows left behind by spec-04's
earlier FAILED-marking flow (rows whose ``route_polyline IS NULL``) — without
the cleanup, the new FE schema would fail to parse the retrieve response
when the user revisits an old failed trip.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from django.db import migrations

if TYPE_CHECKING:
    from django.apps.registry import Apps
    from django.db.backends.base.schema import BaseDatabaseSchemaEditor


def forward_delete_orphan_rows(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Remove rows whose route was never resolved.

    The new contract requires a non-null route_polyline on every Trip. Any
    pre-existing row with NULL polyline is a leftover from the FAILED /
    PLANNING era and is not reachable via the new create path.
    """
    Trip = apps.get_model("trips", "Trip")
    Trip.objects.filter(route_polyline__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("trips", "0002_trip_route_fields_and_cache"),
    ]

    operations: ClassVar[list[migrations.operations.base.Operation]] = [
        migrations.RunPython(forward_delete_orphan_rows, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="trip",
            name="status",
        ),
        migrations.RemoveField(
            model_name="trip",
            name="route_error_code",
        ),
    ]
