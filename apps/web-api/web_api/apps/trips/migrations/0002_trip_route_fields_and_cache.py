"""Trip route fields + TripRouteCache + status enum (spec 04).

Operation order matters for reverse migrations: ``RunPython`` runs AFTER the
``AddField`` ops in forward order so the reverse data-migration step can still
read ``route_polyline__isnull`` (the column has not yet been dropped on
reverse at that point). Putting ``RunPython`` first in forward would put it
LAST in reverse — after the column has been dropped — and the reverse
predicate would raise ``ProgrammingError``.

Forward order:  AddField ×4 → RunPython → AlterField → CreateModel.
Reverse order:  DeleteModel → AlterField (reverse) → RunPython (reverse) →
                AddField (reverse) ×4.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from django.db import migrations, models

if TYPE_CHECKING:
    from django.apps.registry import Apps
    from django.db.backends.base.schema import BaseDatabaseSchemaEditor


def forward_pending_to_planning(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Port any leftover spec-03 ``pending`` rows to the new ``planning`` state."""
    Trip = apps.get_model("trips", "Trip")
    Trip.objects.filter(status="pending").update(status="planning")


def reverse_planning_to_pending(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Revert only the rows we touched on forward (no route data yet)."""
    Trip = apps.get_model("trips", "Trip")
    Trip.objects.filter(status="planning", route_polyline__isnull=True).update(status="pending")


class Migration(migrations.Migration):
    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("trips", "0001_initial"),
    ]

    operations: ClassVar[list[migrations.operations.base.Operation]] = [
        migrations.AddField(
            model_name="trip",
            name="route_polyline",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="trip",
            name="route_segments",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="trip",
            name="route_summary",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="trip",
            name="route_error_code",
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.RunPython(forward_pending_to_planning, reverse_planning_to_pending),
        migrations.AlterField(
            model_name="trip",
            name="status",
            field=models.CharField(
                choices=[
                    ("planning", "Planning"),
                    ("planned", "Planned"),
                    ("failed", "Failed"),
                ],
                default="planning",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="TripRouteCache",
            fields=[
                (
                    "cache_key",
                    models.CharField(max_length=64, primary_key=True, serialize=False),
                ),
                ("coords_canonical", models.CharField(max_length=255)),
                ("payload", models.JSONField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
