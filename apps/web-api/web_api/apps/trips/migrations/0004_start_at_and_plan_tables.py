"""Spec 06 — ``Trip.start_at`` + persisted HOS plan tables.

Forward order:
    AddField(start_at, null=True)
        → RunPython backfill (``start_at = created_at`` for existing rows)
        → AlterField(start_at, null=False)
        → CreateModel TripStop / LogEvent / LogDay

Reverse order (Django runs operations in reverse):
    DeleteModel × 3
        → AlterField (reverse → null=True)
        → RunPython (reverse → ``start_at = NULL`` so RemoveField sees the
          nullable column)
        → RemoveField(start_at)

Index names mirror Django's auto-generated names from the equivalent fresh
``makemigrations`` pass; do NOT rename without re-running makemigrations
(``apps/web-api/CONTRIBUTING.md`` migration-hygiene rule).
"""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, ClassVar

import django.db.models.deletion
from django.db import migrations, models
from django.db.models.functions import Coalesce, Now

if TYPE_CHECKING:
    from django.apps.registry import Apps
    from django.db.backends.base.schema import BaseDatabaseSchemaEditor


def forward_backfill_start_at(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Set ``start_at = COALESCE(created_at, NOW())`` for every existing row.

    Spec 03 / 04 rows lack ``start_at``; ``created_at`` is always populated
    via ``auto_now_add=True`` on every ORM-persisted row. The ``Coalesce`` to
    ``Now()`` is a defensive belt-and-suspenders against rows inserted via
    raw SQL bypassing Django — without it, a NULL ``created_at`` would
    silently leave ``start_at`` NULL and the subsequent ``AlterField`` to
    ``null=False`` would raise ``NotNullViolation`` mid-migration
    (code-reviewer C2).
    """
    Trip = apps.get_model("trips", "Trip")
    Trip.objects.filter(start_at__isnull=True).update(
        start_at=Coalesce("created_at", Now()),
    )


def reverse_clear_start_at(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Reset ``start_at`` to NULL before the column is dropped on reverse."""
    Trip = apps.get_model("trips", "Trip")
    Trip.objects.update(start_at=None)


class Migration(migrations.Migration):
    dependencies: ClassVar[list[tuple[str, str]]] = [
        ("trips", "0003_drop_trip_status_and_error_code"),
    ]

    operations: ClassVar[list[migrations.operations.base.Operation]] = [
        migrations.AddField(
            model_name="trip",
            name="start_at",
            field=models.DateTimeField(null=True),
        ),
        migrations.RunPython(forward_backfill_start_at, reverse_clear_start_at),
        migrations.AlterField(
            model_name="trip",
            name="start_at",
            field=models.DateTimeField(),
        ),
        migrations.CreateModel(
            name="LogDay",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("date", models.DateField()),
                ("off_duty_s", models.PositiveIntegerField()),
                ("sleeper_s", models.PositiveIntegerField()),
                ("driving_s", models.PositiveIntegerField()),
                ("on_duty_not_driving_s", models.PositiveIntegerField()),
                ("total_miles", models.DecimalField(decimal_places=1, max_digits=7)),
                (
                    "trip",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="log_days",
                        to="trips.trip",
                    ),
                ),
            ],
            options={
                "ordering": ("trip", "date"),
                "indexes": [
                    models.Index(fields=["trip", "date"], name="trips_logda_trip_id_e6ba1b_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("trip", "date"),
                        name="unique_trip_log_day_date",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="LogEvent",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("sequence", models.PositiveSmallIntegerField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("off_duty", "Off duty"),
                            ("sleeper_berth", "Sleeper berth"),
                            ("driving", "Driving"),
                            ("on_duty_not_driving", "On duty (not driving)"),
                        ],
                        max_length=32,
                    ),
                ),
                ("start", models.DateTimeField()),
                ("duration_s", models.PositiveIntegerField()),
                ("location", models.CharField(max_length=128)),
                ("note", models.CharField(blank=True, max_length=255)),
                (
                    "trip",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="log_events",
                        to="trips.trip",
                    ),
                ),
            ],
            options={
                "ordering": ("trip", "sequence"),
                "indexes": [
                    models.Index(
                        fields=["trip", "sequence"],
                        name="trips_logev_trip_id_eb17c7_idx",
                    ),
                    models.Index(
                        fields=["trip", "start"],
                        name="trips_logev_trip_id_602a4d_idx",
                    ),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("trip", "sequence"),
                        name="unique_trip_log_event_seq",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="TripStop",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("pickup", "Pickup"),
                            ("dropoff", "Dropoff"),
                            ("fuel", "Fuel"),
                            ("break", "Break"),
                            ("sleeper", "Sleeper"),
                            ("restart", "Restart"),
                        ],
                        max_length=16,
                    ),
                ),
                ("sequence", models.PositiveSmallIntegerField()),
                ("polyline_index", models.PositiveIntegerField()),
                ("lat", models.DecimalField(decimal_places=6, max_digits=9)),
                ("lon", models.DecimalField(decimal_places=6, max_digits=9)),
                ("label", models.CharField(blank=True, max_length=128)),
                ("scheduled_at", models.DateTimeField()),
                ("duration_s", models.PositiveIntegerField()),
                (
                    "trip",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="stops",
                        to="trips.trip",
                    ),
                ),
            ],
            options={
                "ordering": ("trip", "sequence"),
                "indexes": [
                    models.Index(
                        fields=["trip", "sequence"],
                        name="trips_trips_trip_id_54bb53_idx",
                    ),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("trip", "sequence"),
                        name="unique_trip_stop_seq",
                    ),
                ],
            },
        ),
    ]
