"""``fuel_stop_indices`` — threshold sweep + sanity check."""

from __future__ import annotations

import pytest

from tests.hos.conftest import make_directions
from web_api.hos.fueling import _haversine_mi, fuel_stop_indices
from web_api.integrations.openrouteservice import DirectionsSegment


def test_haversine_zero_distance_is_zero() -> None:
    assert _haversine_mi(37.5407, -77.4360, 37.5407, -77.4360) == pytest.approx(0.0, abs=1e-6)


def test_haversine_one_degree_latitude_is_about_69_miles() -> None:
    # 1 degree latitude ≈ pi * 3958.7613 / 180 ≈ 69.09 mi.
    delta = _haversine_mi(37.0, -77.0, 38.0, -77.0)
    assert delta == pytest.approx(69.09, abs=0.5)


def test_no_fuel_stops_for_short_trip() -> None:
    directions = make_directions([60.0, 280.0], [3600, 18000])
    stops = fuel_stop_indices(directions.polyline, directions.segments)
    assert stops == []


def test_one_fuel_stop_for_fifteen_hundred_mile_trip() -> None:
    directions = make_directions([0.0, 1500.0], [0, 22 * 3600])
    stops = fuel_stop_indices(directions.polyline, directions.segments)
    assert len(stops) == 1
    # The chosen vertex should be the one closest to mile 1000.
    assert 950.0 < stops[0].cumulative_mi < 1050.0


def test_two_fuel_stops_for_twenty_five_hundred_mile_trip() -> None:
    directions = make_directions([0.0, 2500.0], [0, 36 * 3600])
    stops = fuel_stop_indices(directions.polyline, directions.segments)
    assert len(stops) == 2
    assert 950.0 < stops[0].cumulative_mi < 1050.0
    assert 1950.0 < stops[1].cumulative_mi < 2050.0


def test_three_fuel_stops_for_thirty_five_hundred_mile_trip() -> None:
    directions = make_directions([0.0, 3500.0], [0, 50 * 3600])
    stops = fuel_stop_indices(directions.polyline, directions.segments)
    assert len(stops) == 3
    cum = [s.cumulative_mi for s in stops]
    assert 950 < cum[0] < 1050
    assert 1950 < cum[1] < 2050
    assert 2950 < cum[2] < 3050


def test_empty_polyline_raises_value_error() -> None:
    with pytest.raises(ValueError, match="polyline must be non-empty"):
        fuel_stop_indices([], [])


def test_zero_distance_polyline_raises_value_error() -> None:
    polyline = [[-77.0, 37.0], [-77.0, 37.0]]
    segments = [DirectionsSegment(distance_mi=0.0, duration_s=0, from_index=0, to_index=1)]
    with pytest.raises(ValueError, match="zero distance"):
        fuel_stop_indices(polyline, segments)


def test_summary_mismatch_beyond_tolerance_raises_value_error() -> None:
    # A polyline whose haversine integral is 100 mi but segments claim 500 mi.
    directions = make_directions([0.0, 100.0], [0, 3600])
    bogus_segments = [
        DirectionsSegment(distance_mi=0.0, duration_s=0, from_index=0, to_index=0),
        DirectionsSegment(
            distance_mi=500.0,
            duration_s=18000,
            from_index=0,
            to_index=len(directions.polyline) - 1,
        ),
    ]
    with pytest.raises(ValueError, match="disagrees with segments"):
        fuel_stop_indices(directions.polyline, bogus_segments)


def test_fuel_stop_lat_lon_match_polyline_vertex() -> None:
    directions = make_directions([0.0, 1500.0], [0, 22 * 3600])
    stops = fuel_stop_indices(directions.polyline, directions.segments)
    stop = stops[0]
    vertex = directions.polyline[stop.polyline_index]
    assert stop.lon == vertex[0]
    assert stop.lat == vertex[1]
