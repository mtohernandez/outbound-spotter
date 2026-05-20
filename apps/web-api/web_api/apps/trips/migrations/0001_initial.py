"""Initial Trip schema.

Stub-stage per spec 03: three address triples + cycle hours + ``status`` +
``created_at``. Spec 04 adds the route/polyline/segments fields.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import ClassVar

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies: ClassVar[list[tuple[str, str]]] = []

    operations: ClassVar[list[migrations.operations.base.Operation]] = [
        migrations.CreateModel(
            name="Trip",
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
                ("user_id", models.CharField(max_length=64)),
                ("current_label", models.CharField(max_length=255)),
                ("current_lat", models.FloatField()),
                ("current_lon", models.FloatField()),
                ("pickup_label", models.CharField(max_length=255)),
                ("pickup_lat", models.FloatField()),
                ("pickup_lon", models.FloatField()),
                ("dropoff_label", models.CharField(max_length=255)),
                ("dropoff_lat", models.FloatField()),
                ("dropoff_lon", models.FloatField()),
                (
                    "cycle_hours_used",
                    models.DecimalField(
                        decimal_places=1,
                        max_digits=3,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0")),
                            django.core.validators.MaxValueValidator(Decimal("70")),
                        ],
                    ),
                ),
                ("status", models.CharField(default="pending", max_length=16)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ("-created_at",),
                "indexes": [
                    models.Index(
                        fields=["user_id", "-created_at"],
                        name="trips_trip_user_id_2f4a85_idx",
                    ),
                ],
            },
        ),
    ]
